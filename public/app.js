const signedOutView = document.getElementById('signedOutView');
const signedInView = document.getElementById('signedInView');
const publishPanel = document.getElementById('publishPanel');
const statusPanel = document.getElementById('statusPanel');
const connectionBadge = document.getElementById('connectionBadge');
const repositorySelect = document.getElementById('repository');
const branchInput = document.getElementById('branch');
const folderInput = document.getElementById('folder');
const publishForm = document.getElementById('publishForm');
const generateButton = document.getElementById('generateButton');
const statusMessage = document.getElementById('statusMessage');
const publishedFiles = document.getElementById('publishedFiles');

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function showStatus(message, type = '') {
  statusPanel.classList.remove('hidden');
  statusMessage.className = `status-message ${type}`.trim();
  statusMessage.textContent = message;
}

async function loadRepositories() {
  repositorySelect.innerHTML = '<option value="">Loading repositories...</option>';

  try {
    const repositories = await request('/api/repositories');
    repositorySelect.innerHTML = '<option value="">Choose a repository</option>';

    for (const repository of repositories) {
      const option = document.createElement('option');
      option.value = repository.fullName;
      option.textContent = `${repository.fullName}${repository.private ? ' (private)' : ''}`;
      option.dataset.branch = repository.defaultBranch;
      repositorySelect.appendChild(option);
    }

    if (!repositories.length) {
      repositorySelect.innerHTML = '<option value="">No writable repositories found</option>';
    }
  } catch (error) {
    repositorySelect.innerHTML = '<option value="">Could not load repositories</option>';
    showStatus(error.message, 'error');
  }
}

repositorySelect.addEventListener('change', () => {
  const option = repositorySelect.selectedOptions[0];
  if (option?.dataset.branch) branchInput.value = option.dataset.branch;
});

document.getElementById('disconnectButton').addEventListener('click', async () => {
  await request('/auth/logout', { method: 'POST', body: '{}' });
  window.location.assign('/');
});

publishForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  publishedFiles.innerHTML = '';
  generateButton.disabled = true;
  generateButton.textContent = 'Generating and publishing...';
  showStatus('n8n is reading the feeds, generating the blog, and returning the files. Keep this page open.');

  try {
    const result = await request('/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        repository: repositorySelect.value,
        branch: branchInput.value.trim(),
        folder: folderInput.value.trim(),
      }),
    });

    showStatus(result.message, 'success');

    for (const file of result.files || []) {
      const item = document.createElement('div');
      item.className = 'file-item';
      const link = file.url
        ? `<a href="${file.url}" target="_blank" rel="noreferrer">${file.path}</a>`
        : file.path;
      item.innerHTML = link;
      publishedFiles.appendChild(item);
    }
  } catch (error) {
    showStatus(error.message, 'error');
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = 'Generate and publish blog';
  }
});

async function initialize() {
  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get('error');
  if (oauthError) showStatus(oauthError, 'error');

  try {
    const session = await request('/api/session');
    connectionBadge.textContent = session.connected ? 'Connected' : 'Not connected';
    connectionBadge.classList.toggle('connected', session.connected);
    signedOutView.classList.toggle('hidden', session.connected);
    signedInView.classList.toggle('hidden', !session.connected);
    publishPanel.classList.toggle('hidden', !session.connected);

    if (session.connected) {
      document.getElementById('avatar').src = session.user?.avatarUrl || '';
      document.getElementById('accountName').textContent = session.user?.name || session.user?.login || 'GitHub user';
      document.getElementById('accountLogin').textContent = `@${session.user?.login || ''}`;
      folderInput.value = session.defaultFolder || 'public/blog';
      await loadRepositories();
    }
  } catch (error) {
    connectionBadge.textContent = 'Configuration error';
    showStatus(error.message, 'error');
  }
}

initialize();
