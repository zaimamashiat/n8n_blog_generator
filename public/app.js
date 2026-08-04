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
  const avatar = $('avatar');
  const accountName = $('accountName');
  const accountLogin = $('accountLogin');

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
        data.error ||
          data.message ||
          `Request failed with status ${response.status}`,
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
      console.log(message);
      return;
    }

    statusPanel.classList.remove('hidden');
    statusMessage.className = `status-message ${type}`.trim();
    statusMessage.textContent = message;
  }

  function clearStatus() {
    if (!statusPanel || !statusMessage) {
      return;
    }

    statusPanel.classList.add('hidden');
    statusMessage.className = 'status-message';
    statusMessage.textContent = '';
  }

  async function loadRepositories() {
    if (!repositorySelect) {
      console.warn('Missing element: #repository');
      return;
    }

    repositorySelect.disabled = true;
    repositorySelect.innerHTML =
      '<option value="">Loading repositories...</option>';

    try {
      const result = await request('/api/repositories');

      const repositories = Array.isArray(result)
        ? result
        : result.repositories || [];

      repositorySelect.innerHTML =
        '<option value="">Choose a repository</option>';

      repositories.forEach((repository) => {
        const option = document.createElement('option');

        option.value =
          repository.fullName ||
          repository.full_name ||
          repository.name ||
          '';

        option.textContent =
          `${option.value}` +
          `${repository.private ? ' (private)' : ''}`;

        option.dataset.branch =
          repository.defaultBranch ||
          repository.default_branch ||
          'main';

        repositorySelect.appendChild(option);
      });

      if (!repositories.length) {
        repositorySelect.innerHTML =
          '<option value="">No writable repositories found</option>';
      }
    } catch (error) {
      repositorySelect.innerHTML =
        '<option value="">Could not load repositories</option>';

      showStatus(error.message, 'error');
    } finally {
      repositorySelect.disabled = false;
    }
  }

  function renderIdeas() {
    if (!ideasGrid) {
      console.warn('Missing element: #ideasGrid');
      return;
    }

    ideasGrid.innerHTML = '';

    generatedIdeas.forEach((idea, index) => {
      const card = document.createElement('article');

      card.className = 'idea-card';
      card.dataset.index = String(index);

      card.innerHTML = `
        <div class="idea-number">
          Idea ${index + 1}
        </div>

        <h3>
          ${escapeHtml(
            idea.angle ||
              idea.title ||
              idea.topic ||
              'Untitled idea',
          )}
        </h3>

        <p class="hook">
          ${escapeHtml(
            idea.hook ||
              idea.description ||
              idea.summary ||
              '',
          )}
        </p>

        <dl>
          <div>
            <dt>Audience</dt>
            <dd>
              ${escapeHtml(
                idea.target_audience ||
                  idea.audience ||
                  'General',
              )}
            </dd>
          </div>

          <div>
            <dt>Service</dt>
            <dd>
              ${escapeHtml(
                idea.related_service ||
                  idea.service ||
                  'Technology',
              )}
            </dd>
          </div>

          <div>
            <dt>Source</dt>
            <dd>
              ${escapeHtml(
                idea.article_source ||
                  idea.source ||
                  'News feed',
              )}
            </dd>
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

    const selectButtons =
      ideasGrid.querySelectorAll('.select-idea');

    selectButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.index);

        if (Number.isNaN(index)) {
          showStatus(
            'Could not select this idea.',
            'error',
          );
          return;
        }

        selectIdea(index);
      });
    });
  }

  function selectIdea(index) {
    selectedIdea = generatedIdeas[index];

    if (!selectedIdea) {
      showStatus(
        'The selected idea could not be found.',
        'error',
      );
      return;
    }

    if (ideasGrid) {
      ideasGrid
        .querySelectorAll('.idea-card')
        .forEach((card, cardIndex) => {
          card.classList.toggle(
            'selected',
            cardIndex === index,
          );
        });
    }

    if (selectedIdeaSummary) {
      selectedIdeaSummary.innerHTML = `
        <span class="eyebrow">
          Selected idea
        </span>

        <h3>
          ${escapeHtml(
            selectedIdea.angle ||
              selectedIdea.title ||
              selectedIdea.topic ||
              'Selected idea',
          )}
        </h3>

        <p>
          ${escapeHtml(
            selectedIdea.hook ||
              selectedIdea.description ||
              selectedIdea.summary ||
              '',
          )}
        </p>
      `;
    }

    publishPanel?.classList.remove('hidden');

    publishPanel?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  repositorySelect?.addEventListener('change', () => {
    const selectedOption =
      repositorySelect.selectedOptions?.[0];

    if (
      selectedOption?.dataset?.branch &&
      branchInput
    ) {
      branchInput.value =
        selectedOption.dataset.branch;
    }
  });

  disconnectButton?.addEventListener(
    'click',
    async () => {
      disconnectButton.disabled = true;
      disconnectButton.textContent =
        'Disconnecting...';

      try {
        await request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({}),
        });

        window.location.assign('/');
      } catch (error) {
        showStatus(error.message, 'error');

        disconnectButton.disabled = false;
        disconnectButton.textContent =
          'Disconnect';
      }
    },
  );

  ideaForm?.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      selectedIdea = null;
      generatedIdeas = [];

      if (ideasGrid) {
        ideasGrid.innerHTML = '';
      }

      if (publishedFiles) {
        publishedFiles.innerHTML = '';
      }

      if (selectedIdeaSummary) {
        selectedIdeaSummary.innerHTML = '';
      }

      ideasPanel?.classList.add('hidden');
      publishPanel?.classList.add('hidden');

      if (ideaButton) {
        ideaButton.disabled = true;
        ideaButton.textContent =
          'Generating ideas...';
      }

      showStatus(
        'n8n is reading current feeds and generating three ideas.',
      );

      try {
        const result = await request('/api/ideas', {
          method: 'POST',
          body: JSON.stringify({
            category:
              categorySelect?.value || 'General',
          }),
        });

        generatedIdeas = Array.isArray(result)
          ? result
          : result.ideas || [];

        if (!generatedIdeas.length) {
          throw new Error(
            'No ideas were returned by n8n.',
          );
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
          ideaButton.textContent =
            'Generate ideas';
        }
      }
    },
  );

  publishForm?.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      if (!selectedIdea) {
        showStatus(
          'Select an idea before publishing.',
          'error',
        );
        return;
      }

      if (
        !repositorySelect?.value
      ) {
        showStatus(
          'Select a GitHub repository.',
          'error',
        );
        return;
      }

      if (publishedFiles) {
        publishedFiles.innerHTML = '';
      }

      if (publishButton) {
        publishButton.disabled = true;
        publishButton.textContent =
          'Writing and publishing...';
      }

      showStatus(
        'n8n is writing the full article from your selected idea.',
      );

      try {
        const result = await request(
          '/api/publish',
          {
            method: 'POST',
            body: JSON.stringify({
              category:
                categorySelect?.value ||
                'General',

              idea: selectedIdea,

              repository:
                repositorySelect.value,

              branch:
                branchInput?.value.trim() ||
                'main',

              folder:
                folderInput?.value.trim() ||
                'public/blog',
            }),
          },
        );

        showStatus(
          result.message ||
            'Blog published successfully.',
          'success',
        );

        const files = result.files || [];

        if (!files.length && publishedFiles) {
          publishedFiles.innerHTML = `
            <div class="file-item">
              Publishing completed.
            </div>
          `;
        }

        files.forEach((file) => {
          const item =
            document.createElement('div');

          item.className = 'file-item';

          const filePath =
            file.path ||
            file.name ||
            'Published file';

          if (file.url) {
            const link =
              document.createElement('a');

            link.href = file.url;
            link.target = '_blank';
            link.rel = 'noreferrer';
            link.textContent = filePath;

            item.appendChild(link);
          } else {
            item.textContent = filePath;
          }

          publishedFiles?.appendChild(item);
        });
      } catch (error) {
        showStatus(error.message, 'error');
      } finally {
        if (publishButton) {
          publishButton.disabled = false;
          publishButton.textContent =
            'Generate full blog and publish';
        }
      }
    },
  );

  async function initialize() {
    const params = new URLSearchParams(
      window.location.search,
    );

    const oauthError =
      params.get('error');

    if (oauthError) {
      showStatus(oauthError, 'error');
    }

    try {
      const session =
        await request('/api/session');

      const connected =
        Boolean(session.connected);

      if (connectionBadge) {
        connectionBadge.textContent =
          connected
            ? 'Connected'
            : 'Not connected';

        connectionBadge.classList.toggle(
          'connected',
          connected,
        );
      }

      signedOutView?.classList.toggle(
        'hidden',
        connected,
      );

      signedInView?.classList.toggle(
        'hidden',
        !connected,
      );

      categoryPanel?.classList.toggle(
        'hidden',
        !connected,
      );

      ideasPanel?.classList.add('hidden');
      publishPanel?.classList.add('hidden');

      if (!oauthError) {
        clearStatus();
      }

      if (connected) {
        if (avatar) {
          avatar.src =
            session.user?.avatarUrl ||
            session.user?.avatar_url ||
            '';

          avatar.alt =
            session.user?.name ||
            session.user?.login ||
            'GitHub user';
        }

        if (accountName) {
          accountName.textContent =
            session.user?.name ||
            session.user?.login ||
            'GitHub user';
        }

        if (accountLogin) {
          accountLogin.textContent =
            session.user?.login
              ? `@${session.user.login}`
              : '';
        }

        if (folderInput) {
          folderInput.value =
            session.defaultFolder ||
            'public/blog';
        }

        if (
          branchInput &&
          !branchInput.value
        ) {
          branchInput.value = 'main';
        }

        await loadRepositories();
      }
    } catch (error) {
      if (connectionBadge) {
        connectionBadge.textContent =
          'Configuration error';

        connectionBadge.classList.remove(
          'connected',
        );
      }

      signedOutView?.classList.remove(
        'hidden',
      );

      signedInView?.classList.add(
        'hidden',
      );

      categoryPanel?.classList.add(
        'hidden',
      );

      showStatus(error.message, 'error');
    }
  }

  initialize();
});