require('dotenv').config();

const crypto = require('crypto');
const path = require('path');
const express = require('express');
const session = require('express-session');

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const requiredEnvironmentVariables = [
  'SESSION_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'N8N_WEBHOOK_URL',
];

for (const key of requiredEnvironmentVariables) {
  if (!process.env[key]) {
    console.warn(`[configuration] Missing ${key}`);
  }
}

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(
  session({
    name: 'blog_publisher_session',
    secret: process.env.SESSION_SECRET || 'development-only-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);
app.use(express.static(path.join(__dirname, 'public')));

function appBaseUrl(req) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

async function githubRequest(endpoint, token, options = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'n8n-github-blog-publisher',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const message = body?.message || body || `GitHub request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.details = body;
    throw error;
  }

  return body;
}

function requireGitHub(req, res, next) {
  if (!req.session.githubToken) {
    return res.status(401).json({ error: 'Connect a GitHub account first.' });
  }
  return next();
}

function safeRepository(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

function safeFolder(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.replace(/^\/+|\/+$/g, '');
  return Boolean(normalized) && !normalized.includes('..') && !normalized.includes('\\');
}

function encodeRepositoryPath(filePath) {
  return filePath
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

app.get('/auth/github', (req, res) => {
  const state = crypto.randomBytes(24).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || '',
    redirect_uri: `${appBaseUrl(req)}/auth/github/callback`,
    scope: process.env.GITHUB_SCOPE || 'public_repo',
    state,
    allow_signup: 'true',
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

app.get('/auth/github/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state || state !== req.session.oauthState) {
      return res.redirect('/?error=Invalid%20OAuth%20state');
    }

    delete req.session.oauthState;

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${appBaseUrl(req)}/auth/github/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || 'GitHub did not return an access token.');
    }

    req.session.githubToken = tokenData.access_token;
    req.session.githubScope = tokenData.scope || '';

    const user = await githubRequest('/user', req.session.githubToken);
    req.session.githubUser = {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
    };

    return res.redirect('/?connected=1');
  } catch (error) {
    console.error('[oauth callback]', error);
    return res.redirect(`/?error=${encodeURIComponent(error.message)}`);
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('blog_publisher_session');
    res.json({ success: true });
  });
});

app.get('/api/session', (req, res) => {
  res.json({
    connected: Boolean(req.session.githubToken),
    user: req.session.githubUser || null,
    scope: req.session.githubScope || null,
    defaultFolder: process.env.DEFAULT_GITHUB_FOLDER || 'public/blog',
  });
});

app.get('/api/repositories', requireGitHub, async (req, res) => {
  try {
    const repositories = await githubRequest(
      '/user/repos?sort=updated&direction=desc&per_page=100&affiliation=owner,collaborator,organization_member',
      req.session.githubToken,
    );

    res.json(
      repositories
        .filter((repository) => !repository.archived && repository.permissions?.push)
        .map((repository) => ({
          fullName: repository.full_name,
          private: repository.private,
          defaultBranch: repository.default_branch,
          updatedAt: repository.updated_at,
        })),
    );
  } catch (error) {
    console.error('[repositories]', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

async function createOrUpdateFile({ token, repository, branch, filePath, content, commitMessage }) {
  const encodedPath = encodeRepositoryPath(filePath);
  let existingSha;

  try {
    const existing = await githubRequest(
      `/repos/${repository}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
      token,
    );
    existingSha = existing.sha;
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  return githubRequest(`/repos/${repository}/contents/${encodedPath}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: commitMessage,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });
}

app.post('/api/generate', requireGitHub, async (req, res) => {
  try {
    const {
      repository,
      branch = 'main',
      folder = process.env.DEFAULT_GITHUB_FOLDER || 'public/blog',
    } = req.body || {};

    if (!safeRepository(repository)) {
      return res.status(400).json({ error: 'Select a valid repository.' });
    }

    if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes('..')) {
      return res.status(400).json({ error: 'Enter a valid branch name.' });
    }

    if (!safeFolder(folder)) {
      return res.status(400).json({ error: 'Enter a valid repository folder.' });
    }

    const webhookHeaders = { 'Content-Type': 'application/json' };
    if (process.env.N8N_WEBHOOK_SECRET) {
      webhookHeaders['X-Webhook-Secret'] = process.env.N8N_WEBHOOK_SECRET;
    }

    const n8nResponse = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: webhookHeaders,
      body: JSON.stringify({ action: 'generate_blog' }),
    });

    const responseText = await n8nResponse.text();
    let generated;

    try {
      generated = JSON.parse(responseText);
    } catch {
      throw new Error(`n8n returned non-JSON content: ${responseText.slice(0, 200)}`);
    }

    if (!n8nResponse.ok) {
      throw new Error(generated?.message || generated?.error || `n8n failed (${n8nResponse.status})`);
    }

    const files = Array.isArray(generated?.files) ? generated.files : [];
    if (!files.length) {
      throw new Error('n8n did not return any files. Import the included website workflow first.');
    }

    const published = [];
    const normalizedFolder = folder.replace(/^\/+|\/+$/g, '');

    for (const file of files) {
      if (!file?.fileName || typeof file.fileContent !== 'string') {
        throw new Error('n8n returned an invalid file object.');
      }

      const fileName = path.posix.basename(file.fileName);
      const repositoryPath = `${normalizedFolder}/${fileName}`;
      const commit = await createOrUpdateFile({
        token: req.session.githubToken,
        repository,
        branch,
        filePath: repositoryPath,
        content: file.fileContent,
        commitMessage: `Publish generated blog file ${fileName}`,
      });

      published.push({
        fileName,
        path: repositoryPath,
        url: commit?.content?.html_url || null,
        commitUrl: commit?.commit?.html_url || null,
      });
    }

    res.json({
      success: true,
      message: `Published ${published.length} file(s) to ${repository}.`,
      repository,
      branch,
      files: published,
    });
  } catch (error) {
    console.error('[generate]', error);
    res.status(error.status || 500).json({
      error: error.message || 'Generation failed.',
      details: isProduction ? undefined : error.details,
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Blog publisher running at http://localhost:${port}`);
});
