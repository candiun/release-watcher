import { Notification } from 'electron';
import { POLL_TIMEOUT_MS } from '../constants';
import { sourceWithComputedFlags } from '../store/sanitize';
import { extractSourceValue } from './extraction-service';
import type { SourceRecord, SourceView } from '../../shared/types';
import type { StoreService } from '../store/store-service';

interface PollingServiceOptions {
  storeService: StoreService;
  isMainWindowVisible: () => boolean;
  markUnseenUpdate: () => void;
  onStoreMutated?: () => void;
}

export class PollingService {
  private readonly storeService: StoreService;
  private readonly isMainWindowVisible: () => boolean;
  private readonly markUnseenUpdate: () => void;
  private readonly onStoreMutated?: () => void;
  private pollMutex: Promise<void> = Promise.resolve();

  constructor(options: PollingServiceOptions) {
    this.storeService = options.storeService;
    this.isMainWindowVisible = options.isMainWindowVisible;
    this.markUnseenUpdate = options.markUnseenUpdate;
    this.onStoreMutated = options.onStoreMutated;
  }

  withPollLock<T>(task: () => Promise<T>): Promise<T> {
    const run = this.pollMutex.then(() => task());
    this.pollMutex = run
      .then(() => undefined)
      .catch((error) => {
        console.error('Polling error:', error);
      });
    return run;
  }

  async pollSourceById(sourceId: string): Promise<SourceRecord> {
    const store = await this.storeService.load();
    const source = store.sources.find((item) => item.id === sourceId);
    if (!source) {
      throw new Error('Source not found.');
    }

    const nowIso = new Date().toISOString();

    try {
      const response = await this.fetchWithTimeout(source.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const body = await response.text();
      const extracted = extractSourceValue(body, source);

      const previousValue = source.lastValue;
      const isFirstSuccessfulPoll = previousValue === null || previousValue === undefined;
      const changed = !isFirstSuccessfulPoll && extracted !== previousValue;

      source.lastPolledAt = nowIso;
      source.lastStatus = 'ok';
      source.lastError = null;

      if (isFirstSuccessfulPoll || changed) {
        source.lastValue = extracted;
        source.lastChangeAt = nowIso;
        source.lastChangeType = isFirstSuccessfulPoll ? 'baseline' : 'update';
      }

      source.updatedAt = nowIso;

      if (changed) {
        this.triggerNotification(source, previousValue, extracted);
        if (!this.isMainWindowVisible()) {
          this.markUnseenUpdate();
        }
      }
    } catch (error) {
      source.lastPolledAt = nowIso;
      source.lastStatus = 'error';
      source.lastError = error instanceof Error ? error.message : String(error);
      source.updatedAt = nowIso;
    }

    this.onStoreMutated?.();
    return source;
  }

  async pollAllSources(): Promise<SourceView[]> {
    const store = await this.storeService.load();

    for (const source of store.sources) {
      await this.pollSourceById(source.id);
    }

    await this.storeService.persist();
    this.onStoreMutated?.();

    return store.sources.map(sourceWithComputedFlags);
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);

    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ReleaseWatcher/0.1'
        }
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private triggerNotification(
    source: SourceRecord,
    previousValue: string | null,
    currentValue: string
  ): void {
    if (!Notification.isSupported()) {
      return;
    }

    const body = `New value: ${currentValue}`;
    const detail = previousValue ? ` (was ${previousValue})` : '';

    const notification = new Notification({
      title: `${source.name} updated`,
      body: `${body}${detail}`
    });

    notification.show();
  }
}
