document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  const signedOutView = $('signedOutView');
  const signedInView = $('signedInView');
  const categoryPanel = $('categoryPanel');
  const ideasPanel = $('ideasPanel');
  const publishPanel = $('publishPanel');
  const statusPanel = $('statusPanel');

  const connectionBadge = $('connectionBadge');
  const categorySelect = $('category');
  const ideaForm = $('ideaForm');
  const ideaButton = $('ideaButton');
  const ideasGrid = $('ideasGrid');

  const repositorySelect = $('repository');
  const branchInput = $('branch');
  const folderInput = $('folder');

  const publishForm = $('publishForm');
  const publishButton = $('publishButton');
  const selectedIdeaSummary = $('selectedIdeaSummary');

  const statusMessage = $('statusMessage');
  const publishedFiles = $('publishedFiles');
  const disconnectButton = $('disconnectButton');

  let generatedIdeas = [];
  let selectedIdea = null;

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || `Request failed with status ${response.status}`,
      );
    }

    return data;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function showStatus(message, type = '') {
    if (!statusPanel || !statusMessage) {
      console.error(message);
      return;
    }

    statusPanel.classList.remove('hidden');
    statusMessage.className = `status-message ${type}`.trim();
    statusMessage.textContent = message;
  }

  async function loadRepositories() {
    if (!repositorySelect) {
      return;
    }

    repositorySelect.innerHTML =
      '<option value="">Loading repositories...</option>';

    try {
      const repositories = await request('/api/repositories');

      repositorySelect.innerHTML =
        '<option value="">Choose a repository</option>';

      for (const repository of repositories) {
        const option = document.createElement('option');

        option.value = repository.fullName;
        option.textContent =
          `${repository.fullName}` +
          `${repository.private ? ' (private)' : ''}`;

        option.dataset.branch = repository.defaultBranch;

        repositorySelect.appendChild(option);
      }

      if (!repositories.length) {
        repositorySelect.innerHTML =
          '<option value="">No writable repositories found</option>';
      }
    } catch (error) {
      repositorySelect.innerHTML =
        '<option value="">Could not load repositories</option>';

      showStatus(error.message, 'error');
    }
  }

  function renderIdeas() {
    if (!ideasGrid) {
      return;
    }

    ideasGrid.innerHTML = '';

    generatedIdeas.forEach((idea, index) => {
      const card = document.createElement('article');

      card.className = 'idea-card';

      card.innerHTML = `
        <div class="idea-number">Idea ${index + 1}</div>

        <h3>${escapeHtml(idea.angle || 'Untitled idea')}</h3>

        <p class="hook">${escapeHtml(idea.hook || '')}</p>

        <dl>
          <div>
            <dt>Audience</dt>
            <dd>${escapeHtml(idea.target_audience || 'General')}</dd>
          </div>

          <div>
            <dt>Service</dt>
            <dd>${escapeHtml(idea.related_service || 'Technology')}</dd>
          </div>

          <div>
            <dt>Source</dt>
            <dd>${escapeHtml(idea.article_source || 'News feed')}</dd>
          </div>
        </dl>

        <button
          class="button select-idea"
          type="button"
          data-index="${index}"
        >
          Select this idea
        </button>
      `;

      ideasGrid.appendChild(card);
    });

    ideasGrid
      .querySelectorAll('.select-idea')
      .forEach((button) => {
        button.addEventListener('click', () => {
          selectIdea(Number(button.dataset.index));
        });
      });
  }

  function selectIdea(index) {
    selectedIdea = generatedIdeas[index];

    if (!selectedIdea) {
      showStatus('The selected idea could not be found.', 'error');
      return;
    }

    ideasGrid
      ?.querySelectorAll('.idea-card')
      .forEach((card, cardIndex) => {
        card.classList.toggle(
          'selected',
          cardIndex === index,
        );
      });

    if (selectedIdeaSummary) {
      selectedIdeaSummary.innerHTML = `
        <span class="eyebrow">Selected idea</span>

        <h3>${escapeHtml(selectedIdea.angle)}</h3>

        <p>${escapeHtml(selectedIdea.hook || '')}</p>
      `;
    }

    publishPanel?.classList.remove('hidden');

    publishPanel?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  repositorySelect?.addEventListener('change', () => {
    const option = repositorySelect.selectedOptions[0];

    if (option?.dataset.branch && branchInput) {
      branchInput.value = option.dataset.branch;
    }
  });

  disconnectButton?.addEventListener('click', async () => {
    try {
      await request('/auth/logout', {
        method: 'POST',
        body: '{}',
      });

      window.location.assign('/');
    } catch (error) {
      showStatus(error.message, 'error');
    }
  });

  ideaForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    selectedIdea = null;
    generatedIdeas = [];

    if (ideasGrid) {
      ideasGrid.innerHTML = '';
    }

    if (publishedFiles) {
      publishedFiles.innerHTML = '';
    }

    ideasPanel?.classList.add('hidden');
    publishPanel?.classList.add('hidden');

    if (ideaButton) {
      ideaButton.disabled = true;
      ideaButton.textContent = 'Generating ideas...';
    }

    showStatus(
      'n8n is reading current feeds and generating three ideas.',
    );

    try {
      const result = await request('/api/ideas', {
        method: 'POST',
        body: JSON.stringify({
          category: categorySelect?.value || '',
        }),
      });

      generatedIdeas = result.ideas || [];

      if (!generatedIdeas.length) {
        throw new Error('No ideas were returned.');
      }

      renderIdeas();

      ideasPanel?.classList.remove('hidden');

      showStatus(
        `Generated ${generatedIdeas.length} ideas. Select one to continue.`,
        'success',
      );

      ideasPanel?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    } catch (error) {
      showStatus(error.message, 'error');
    } finally {
      if (ideaButton) {
        ideaButton.disabled = false;
        ideaButton.textContent = 'Generate ideas';
      }
    }
  });

  publishForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!selectedIdea) {
      showStatus(
        'Select an idea before publishing.',
        'error',
      );
      return;
    }

    if (publishedFiles) {
      publishedFiles.innerHTML = '';
    }

    if (publishButton) {
      publishButton.disabled = true;
      publishButton.textContent = 'Writing and publishing...';
    }

    showStatus(
      'n8n is writing the full article from your selected idea.',
    );

    try {
      const result = await request('/api/publish', {
        method: 'POST',
        body: JSON.stringify({
          category: categorySelect?.value || '',
          idea: selectedIdea,
          repository: repositorySelect?.value || '',
          branch: branchInput?.value.trim() || 'main',
          folder: folderInput?.value.trim() || 'public/blog',
        }),
      });

      showStatus(result.message, 'success');

      for (const file of result.files || []) {
        const item = document.createElement('div');

        item.className = 'file-item';

        item.innerHTML = file.url
          ? `
            <a
              href="${escapeHtml(file.url)}"
              target="_blank"
              rel="noreferrer"
            >
              ${escapeHtml(file.path)}
            </a>
          `
          : escapeHtml(file.path);

        publishedFiles?.appendChild(item);
      }
    } catch (error) {
      showStatus(error.message, 'error');
    } finally {
      if (publishButton) {
        publishButton.disabled = false;
        publishButton.textContent =
          'Generate full blog and publish';
      }
    }
  });

  async function initialize() {
    const params = new URLSearchParams(
      window.location.search,
    );

    const oauthError = params.get('error');

    if (oauthError) {
      showStatus(oauthError, 'error');
    }

    try {
      const session = await request('/api/session');

      if (connectionBadge) {
        connectionBadge.textContent =
          session.connected
            ? 'Connected'
            : 'Not connected';

        connectionBadge.classList.toggle(
          'connected',
          session.connected,
        );
      }

      signedOutView?.classList.toggle(
        'hidden',
        session.connected,
      );

      signedInView?.classList.toggle(
        'hidden',
        !session.connected,
      );

      categoryPanel?.classList.toggle(
        'hidden',
        !session.connected,
      );

      if (session.connected) {
        const avatar = $('avatar');
        const accountName = $('accountName');
        const accountLogin = $('accountLogin');

        if (avatar) {
          avatar.src = session.user?.avatarUrl || '';
        }

        if (accountName) {
          accountName.textContent =
            session.user?.name ||
            session.user?.login ||
            'GitHub user';
        }

        if (accountLogin) {
          accountLogin.textContent =
            `@${session.user?.login || ''}`;
        }

        if (folderInput) {
          folderInput.value =
            session.defaultFolder || 'public/blog';
        }

        await loadRepositories();
      }
    } catch (error) {
      if (connectionBadge) {
        connectionBadge.textContent =
          'Configuration error';
      }

      showStatus(error.message, 'error');
    }
  }

  initialize();
});