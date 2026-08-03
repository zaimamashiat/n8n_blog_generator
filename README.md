# n8n GitHub Blog Publisher

This project provides a website where a user can:

1. Connect their GitHub account through OAuth.
2. Select a writable repository.
3. Choose a branch and destination folder.
4. Trigger the n8n blog-generation workflow.
5. Publish the returned `.mdx` and `.json` files to the selected repository.

The GitHub access token is stored only in the server session. It is not placed in frontend JavaScript and is not sent to n8n.

## Project structure

```text
n8n-github-blog-app/
├── public/
│   ├── app.js
│   ├── index.html
│   └── style.css
├── .env.example
├── .gitignore
├── n8n-workflow-website-version.json
├── original-workflow.json
├── package.json
├── README.md
└── server.js
```

## Requirements

- Node.js 20 or newer
- npm
- An n8n account
- A GitHub account
- A GitHub OAuth App
- A configured Groq credential in n8n

## 1. Import the website version of the n8n workflow

Import this file into n8n:

```text
n8n-workflow-website-version.json
```

This version differs from the original workflow in one important way:

- It no longer uploads files using a fixed n8n GitHub credential.
- It returns the generated MDX and JSON files to the website backend.
- The website backend publishes them using the GitHub account connected by the current user.

After importing:

1. Open each Groq model node and select your Groq credential.
2. Open the Webhook node.
3. Confirm the HTTP method is `POST`.
4. Confirm **Respond** is set to **Using Respond to Webhook Node**.
5. Save and activate the workflow.
6. Copy its production URL.

The included path is:

```text
f4f526f6-4f6c-4988-82b0-cdc0d8c4f52a
```

Your production URL should therefore resemble:

```text
https://YOUR-N8N-DOMAIN/webhook/f4f526f6-4f6c-4988-82b0-cdc0d8c4f52a
```

## 2. Create a GitHub OAuth App

In GitHub:

1. Open **Settings**.
2. Open **Developer settings**.
3. Open **OAuth Apps**.
4. Select **New OAuth App**.
5. Enter these local-development values:

```text
Application name: n8n Blog Publisher
Homepage URL: http://localhost:3000
Authorization callback URL: http://localhost:3000/auth/github/callback
```

6. Create the app.
7. Copy the Client ID.
8. Generate and copy a Client Secret.

For a deployed website, replace localhost with the real HTTPS domain in both GitHub and `.env`.

## 3. Configure the project

Open a terminal in this folder and run:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

Edit `.env`:

```env
PORT=3000
APP_BASE_URL=http://localhost:3000
SESSION_SECRET=replace-with-a-long-random-secret
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_SCOPE=public_repo
N8N_WEBHOOK_URL=https://YOUR-N8N-DOMAIN/webhook/YOUR-WEBHOOK-PATH
DEFAULT_GITHUB_FOLDER=public/blog
NODE_ENV=development
```

Generate a session secret with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### GitHub scope

Use:

```env
GITHUB_SCOPE=public_repo
```

for public repositories only.

Use:

```env
GITHUB_SCOPE=repo
```

when users must access private repositories. The `repo` scope is broad, so only use it when required.

## 4. Install and run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Then:

1. Click **Connect GitHub**.
2. Authorize the OAuth App.
3. Select a repository.
4. Confirm the branch.
5. Enter the folder, such as `public/blog`.
6. Click **Generate and publish blog**.

The server will:

1. Call the n8n webhook.
2. Receive the generated MDX and JSON content.
3. Base64-encode each file as required by GitHub's Contents API.
4. Commit both files to the selected repository and branch.
5. Show links to the published files.

## 5. Optional n8n webhook protection

You can protect the n8n webhook with a shared header secret.

In `.env`:

```env
N8N_WEBHOOK_SECRET=a-long-random-secret
```

In the n8n Webhook node, configure Header Auth so that the request must include:

```text
X-Webhook-Secret: a-long-random-secret
```

Do not place this secret in frontend code.

## 6. Deploying

This is a Node.js application and can be deployed to services such as Render, Railway, Fly.io, or a VPS.

Set these production environment variables in the hosting dashboard:

```env
APP_BASE_URL=https://your-domain.com
SESSION_SECRET=your-production-secret
GITHUB_CLIENT_ID=your-production-oauth-client-id
GITHUB_CLIENT_SECRET=your-production-oauth-client-secret
GITHUB_SCOPE=public_repo
N8N_WEBHOOK_URL=https://YOUR-N8N-DOMAIN/webhook/YOUR-WEBHOOK-PATH
NODE_ENV=production
```

Update the GitHub OAuth App:

```text
Homepage URL: https://your-domain.com
Authorization callback URL: https://your-domain.com/auth/github/callback
```

The production server must use HTTPS because the session cookie is configured as secure in production.

## Important security notes

- Never commit `.env`.
- Never place the GitHub Client Secret in `public/app.js`.
- Never ask users to paste personal access tokens into a browser form.
- The built-in session store is acceptable for local testing, not a scaled production deployment. Use Redis or another persistent session store before running multiple server instances.
- OAuth Apps grant account-level scopes. A GitHub App is preferable for a mature public product because repository permissions can be more fine-grained.
- The generated workflow still references your Groq credential by name/ID. Re-select the credential after importing it into another n8n account.

## Troubleshooting

### `n8n did not return any files`

You are probably using the original workflow. Import and activate `n8n-workflow-website-version.json`.

### GitHub callback mismatch

The callback in GitHub must exactly equal:

```text
http://localhost:3000/auth/github/callback
```

or your exact deployed HTTPS callback.

### Repository does not appear

The OAuth user must have push access. Archived and read-only repositories are intentionally removed from the list.

### GitHub returns 404 while publishing

Check the repository, branch name, organization OAuth restrictions, and the selected OAuth scope.

### n8n times out

Long workflows can exceed webhook response limits. Reduce the number of analyzed articles or redesign the workflow as an asynchronous job with a status endpoint.
