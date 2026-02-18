import { Notification } from 'electron';
import { createHash } from 'node:crypto';
import { POLL_TIMEOUT_MS } from '../constants';
import { sourceWithComputedFlags } from '../store/sanitize';
import { extractSourceValue } from './extraction-service';
import type { SourceRecord, SourceView } from '../../shared/types';
import type { StoreService } from '../store/store-service';

interface PollingServiceOptions {
  storeService: StoreService;
  isAppActive: () => boolean;
  markUnseenUpdate: () => void;
  onStoreMutated?: () => void;
}

export class PollingService {
  private readonly storeService: StoreService;
  private readonly isAppActive: () => boolean;
  private readonly markUnseenUpdate: () => void;
  private readonly onStoreMutated: (() => void) | undefined;
  private pollMutex: Promise<void> = Promise.resolve();

  constructor(options: PollingServiceOptions) {
    this.storeService = options.storeService;
    this.isAppActive = options.isAppActive;
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
      const response = await this.fetchWithTimeout(source.url, source);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const body = await response.text();
      const extracted = extractSourceValue(body, source);
      const { displayValue, fingerprint } = this.toValueSnapshot(extracted);

      const previousValue = source.lastValue;
      const previousFingerprint = source.lastFingerprint;
      const isFirstSuccessfulPoll = previousFingerprint === null;
      const changed = !isFirstSuccessfulPoll && fingerprint !== previousFingerprint;

      source.lastPolledAt = nowIso;
      source.lastStatus = 'ok';
      source.lastError = null;

      if (isFirstSuccessfulPoll || changed) {
        source.lastValue = displayValue;
        source.lastFingerprint = fingerprint;
        source.lastChangeAt = nowIso;
        source.lastChangeType = isFirstSuccessfulPoll ? 'baseline' : 'update';
      }

      source.updatedAt = nowIso;

      if (changed) {
        this.triggerNotification(source, previousValue, displayValue);
        if (!this.isAppActive()) {
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

  private async fetchWithTimeout(url: string, source: SourceRecord): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);

    try {
      const customHeaders = this.parseHeaders(source.requestHeaders);
      return await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ReleaseWatcher/0.1',
          ...customHeaders,
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseHeaders(headersText: string): Record<string, string> {
    const trimmed = headersText.trim();
    if (!trimmed) {
      return {};
    }

    if (trimmed.startsWith('{')) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed) as unknown;
      } catch {
        throw new Error('Invalid headers JSON.');
      }

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Headers JSON must be an object.');
      }

      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        result[String(key).trim()] = String(value).trim();
      }

      return result;
    }

    const headers: Record<string, string> = {};
    const lines = trimmed.split(/\\r?\\n/);

    for (const line of lines) {
      const normalizedLine = line.trim();
      if (!normalizedLine || normalizedLine.startsWith('#')) {
        continue;
      }

      const separatorIndex = normalizedLine.indexOf(':');
      if (separatorIndex <= 0) {
        throw new Error(`Invalid header line: ${normalizedLine}`);
      }

      const key = normalizedLine.slice(0, separatorIndex).trim();
      const value = normalizedLine.slice(separatorIndex + 1).trim();
      headers[key] = value;
    }

    return headers;
  }

  private stableStringify(value: unknown): string {
    if (value === null) {
      return 'null';
    }

    if (typeof value === 'string') {
      return JSON.stringify(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b)
      );
      const serialized = entries.map(
        ([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`
      );
      return `{${serialized.join(',')}}`;
    }

    if (typeof value === 'bigint') {
      return JSON.stringify(value.toString());
    }

    if (typeof value === 'symbol' || typeof value === 'function') {
      return JSON.stringify(Object.prototype.toString.call(value));
    }

    return JSON.stringify('undefined');
  }

  private toValueSnapshot(extracted: unknown): { displayValue: string; fingerprint: string } {
    if (typeof extracted === 'string') {
      const normalized = extracted.trim().replace(/\\s+/g, ' ');
      return {
        displayValue: normalized,
        fingerprint: `str:${normalized}`,
      };
    }

    if (typeof extracted === 'number') {
      const normalized = String(extracted);
      return {
        displayValue: normalized,
        fingerprint: `num:${normalized}`,
      };
    }

    const serialized = this.stableStringify(extracted);
    const hash = createHash('sha256').update(serialized).digest('hex');

    return {
      displayValue: `sha256:${hash.slice(0, 16)}`,
      fingerprint: `sha256:${hash}`,
    };
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
      body: `${body}${detail}`,
    });

    notification.show();
  }
}
