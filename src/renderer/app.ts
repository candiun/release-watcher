import type { AppSettings, SourceInput, SourceView } from '../shared/types';
import { collectElements, type Elements } from './dom.js';
import { escapeHtml, formatDate, sortSourcesByNewVersionDesc } from './format.js';

interface RendererState {
  sources: SourceView[];
  settings: AppSettings;
  editingId: string | null;
}

export class RendererApp {
  private readonly api = window.releaseTrackerApi;
  private readonly elements: Elements;
  private readonly state: RendererState;
  private toastTimeoutId: number | null = null;
  private refreshInFlight = false;
  private refreshQueued = false;

  constructor() {
    this.elements = collectElements();
    this.state = {
      sources: [],
      settings: {
        schemaVersion: 4,
        autoPollEnabled: true,
        autoPollMinutes: 30,
        unseenUpdateCount: 0,
      },
      editingId: null,
    };
  }

  async init(): Promise<void> {
    this.bindEvents();
    this.api.onStoreUpdated(() => {
      this.refreshSourcesFromStoreEvent().catch((error) => {
        console.error('Failed to refresh sources after store update:', error);
      });
    });
    await this.refreshAllData();
  }

  private showToast(message: string, timeoutMs = 2500): void {
    this.elements.toast.textContent = message;
    this.elements.toast.hidden = false;

    if (this.toastTimeoutId !== null) {
      window.clearTimeout(this.toastTimeoutId);
    }

    this.toastTimeoutId = window.setTimeout(() => {
      this.elements.toast.hidden = true;
    }, timeoutMs);
  }

  private updateTypeDependentFields(): void {
    const type = this.elements.sourceType.value;

    const isJson = type === 'json';
    this.elements.jsonPathWrap.style.display = isJson ? 'grid' : 'none';

    const isHtml = type === 'html';
    this.elements.selectorWrap.style.display = isHtml ? 'grid' : 'none';
    this.elements.attributeWrap.style.display = isHtml ? 'grid' : 'none';

    this.elements.sourceJsonPath.required = false;
    this.elements.sourceSelector.required = isHtml;
  }

  private renderSources(): void {
    if (this.state.sources.length === 0) {
      this.elements.tbody.innerHTML =
        '<tr><td colspan="6">No sources yet. Add one to start monitoring releases.</td></tr>';
      return;
    }

    this.elements.tbody.innerHTML = sortSourcesByNewVersionDesc(this.state.sources)
      .map((source) => {
        const latestValue = source.lastValue ? escapeHtml(source.lastValue) : '<em>n/a</em>';
        const newBadge = source.isNew ? '<span class="value-pill">New (2h)</span>' : '';
        const newVersionAt =
          source.lastChangeType === 'update' ? escapeHtml(formatDate(source.lastChangeAt)) : '-';
        const statusClass = source.lastStatus === 'error' ? 'error' : 'ok';
        const statusText =
          source.lastStatus === 'error' ? 'Error' : source.lastStatus === 'ok' ? 'OK' : 'Never';
        const statusDetail = source.lastError ? `<div>${escapeHtml(source.lastError)}</div>` : '';

        return `
      <tr>
        <td>
          <div>${escapeHtml(source.name)}</div>
        </td>
        <td class="latest">
          <div>${latestValue}</div>
          ${newBadge}
        </td>
        <td>${escapeHtml(formatDate(source.lastPolledAt))}</td>
        <td>${newVersionAt}</td>
        <td>
          <div class="status ${statusClass}">${statusText}</div>
          ${statusDetail}
        </td>
        <td>
          <div class="actions">
            <details class="actions-menu">
              <summary class="menu-toggle" aria-label="Open actions">...</summary>
              <ul class="menu-list">
                <li><button type="button" class="menu-item" data-action="poll" data-id="${source.id}">Poll</button></li>
                <li><button type="button" class="menu-item" data-action="edit" data-id="${source.id}">Edit</button></li>
                <li><button type="button" class="menu-item danger" data-action="delete" data-id="${source.id}">Delete</button></li>
              </ul>
            </details>
          </div>
        </td>
      </tr>`;
      })
      .join('');
  }

  private fillForm(source: SourceView | null): void {
    this.state.editingId = source?.id || null;
    this.elements.dialogTitle.textContent = source ? 'Edit Source' : 'New Source';

    this.elements.sourceName.value = source?.name || '';
    this.elements.sourceUrl.value = source?.url || '';
    this.elements.sourceRequestHeaders.value = source?.requestHeaders || '';
    this.elements.sourceType.value = source?.type || 'json';
    this.elements.sourceJsonPath.value = source?.outputSelector || '';
    this.elements.sourceSelector.value = source?.selector || '';
    this.elements.sourceAttribute.value = source?.attribute || '';
    this.elements.sourceRegex.value = source?.regex || '';
    this.elements.sourceNotes.value = source?.notes || '';

    this.updateTypeDependentFields();
  }

  private openNewDialog(): void {
    this.fillForm(null);
    this.elements.dialog.showModal();
  }

  private openEditDialog(sourceId: string): void {
    const source = this.state.sources.find((item) => item.id === sourceId);
    if (!source) {
      this.showToast('Source not found');
      return;
    }

    this.fillForm(source);
    this.elements.dialog.showModal();
  }

  private async refreshAllData(): Promise<void> {
    const [sources, settings] = await Promise.all([this.api.listSources(), this.api.getSettings()]);

    this.state.sources = sources;
    this.state.settings = settings;

    this.elements.autoPollEnabled.checked = this.state.settings.autoPollEnabled;
    this.elements.autoPollMinutes.value = String(this.state.settings.autoPollMinutes);

    this.renderSources();
  }

  private async refreshSourcesFromStoreEvent(): Promise<void> {
    if (this.refreshInFlight) {
      this.refreshQueued = true;
      return;
    }

    this.refreshInFlight = true;

    try {
      this.state.sources = await this.api.listSources();
      this.renderSources();
    } finally {
      this.refreshInFlight = false;
    }

    if (this.refreshQueued) {
      this.refreshQueued = false;
      await this.refreshSourcesFromStoreEvent();
    }
  }

  private async saveSourceFromForm(): Promise<void> {
    const source: SourceInput = {
      id: this.state.editingId,
      name: this.elements.sourceName.value.trim(),
      url: this.elements.sourceUrl.value.trim(),
      type: this.elements.sourceType.value as SourceInput['type'],
      outputSelector: this.elements.sourceJsonPath.value.trim(),
      requestHeaders: this.elements.sourceRequestHeaders.value.trim(),
      selector: this.elements.sourceSelector.value.trim(),
      attribute: this.elements.sourceAttribute.value.trim(),
      regex: this.elements.sourceRegex.value.trim(),
      notes: this.elements.sourceNotes.value.trim(),
    };

    if (!source.name || !source.url) {
      this.showToast('Name and URL are required');
      return;
    }

    try {
      this.state.sources = await this.api.saveSource(source);
      this.renderSources();
      this.elements.dialog.close();
      this.showToast('Source saved');
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : 'Failed to save source');
    }
  }

  private async deleteSource(sourceId: string): Promise<void> {
    const source = this.state.sources.find((item) => item.id === sourceId);
    if (!source) {
      return;
    }

    const confirmed = window.confirm(`Delete source "${source.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      this.state.sources = await this.api.deleteSource(sourceId);
      this.renderSources();
      this.showToast('Source deleted');
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : 'Failed to delete source');
    }
  }

  private async pollSource(sourceId: string): Promise<void> {
    try {
      this.state.sources = await this.api.pollSource(sourceId);
      this.renderSources();
      this.showToast('Source polled');
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : 'Failed to poll source');
    }
  }

  private async pollAllSources(): Promise<void> {
    this.elements.pollAllBtn.disabled = true;

    try {
      this.state.sources = await this.api.pollAll();
      this.renderSources();
      this.showToast('All sources polled');
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : 'Failed to poll all sources');
    } finally {
      this.elements.pollAllBtn.disabled = false;
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      this.state.settings = await this.api.updateSettings({
        autoPollEnabled: this.elements.autoPollEnabled.checked,
        autoPollMinutes: Number(this.elements.autoPollMinutes.value),
      });

      this.elements.autoPollEnabled.checked = this.state.settings.autoPollEnabled;
      this.elements.autoPollMinutes.value = String(this.state.settings.autoPollMinutes);

      this.showToast('Settings updated');
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : 'Failed to update settings');
    }
  }

  private bindEvents(): void {
    this.elements.newSourceBtn.addEventListener('click', () => this.openNewDialog());
    this.elements.cancelSourceBtn.addEventListener('click', () => this.elements.dialog.close());
    this.elements.sourceType.addEventListener('change', () => this.updateTypeDependentFields());

    this.elements.form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.saveSourceFromForm();
    });

    this.elements.pollAllBtn.addEventListener('click', () => {
      void this.pollAllSources();
    });

    this.elements.saveSettingsBtn.addEventListener('click', () => {
      void this.saveSettings();
    });

    this.elements.tbody.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.classList.contains('menu-toggle')) {
        const currentMenu = target.closest('details');
        if (currentMenu instanceof HTMLDetailsElement) {
          for (const menu of this.elements.tbody.querySelectorAll('.actions-menu[open]')) {
            if (menu !== currentMenu) {
              (menu as HTMLDetailsElement).open = false;
            }
          }
        }
        return;
      }

      const action = target.getAttribute('data-action');
      const sourceId = target.getAttribute('data-id');

      if (!action || !sourceId) {
        return;
      }

      const menu = target.closest('details');
      if (menu instanceof HTMLDetailsElement) {
        menu.open = false;
      }

      if (action === 'edit') {
        this.openEditDialog(sourceId);
        return;
      }

      if (action === 'delete') {
        this.deleteSource(sourceId).catch((error) => {
          this.showToast(error instanceof Error ? error.message : 'Failed to delete source');
        });
        return;
      }

      if (action === 'poll') {
        this.pollSource(sourceId).catch((error) => {
          this.showToast(error instanceof Error ? error.message : 'Failed to poll source');
        });
      }
    });
  }
}
