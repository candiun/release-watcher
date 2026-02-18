import { randomUUID } from 'node:crypto';
import { CURRENT_SCHEMA_VERSION, TWO_HOURS_MS } from '../constants';
import { createOpenAICodexSource, defaultSources, defaultStore } from './defaults';
import type { AppSettings, SourceInput, SourceRecord, SourceType, SourceView, StoreData } from '../../shared/types';

export function sanitizeAutoPollMinutes(value: unknown): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.max(5, Math.min(24 * 60, Math.round(numeric)));
  }
  return 30;
}

export function sanitizeSchemaVersion(value: unknown): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.max(1, Math.floor(numeric));
  }
  return 1;
}

export function sanitizeUnseenUpdateCount(value: unknown): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.floor(numeric));
  }
  return 0;
}

function normalizeType(type: unknown): SourceType | null {
  if (type === 'json' || type === 'html') {
    return type;
  }
  return null;
}

export function sanitizeSource(input: unknown, isNew: boolean): SourceRecord | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const raw = input as Partial<SourceRecord>;
  const type = normalizeType(raw.type);
  if (!type) {
    return null;
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  if (!name || !url) {
    return null;
  }

  try {
    new URL(url);
  } catch {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id: isNew ? randomUUID() : String(raw.id || randomUUID()),
    name,
    url,
    type,
    jsonPath: type === 'json' ? String(raw.jsonPath || '').trim() : '',
    selector: type === 'html' ? String(raw.selector || '').trim() : '',
    attribute: type === 'html' ? String(raw.attribute || '').trim() : '',
    regex: String(raw.regex || '').trim(),
    notes: typeof raw.notes === 'string' ? raw.notes.trim() : '',
    createdAt: isNew ? now : raw.createdAt || now,
    updatedAt: now,
    lastValue: !isNew ? (raw.lastValue ?? null) : null,
    lastPolledAt: !isNew ? (raw.lastPolledAt ?? null) : null,
    lastChangeAt: !isNew ? (raw.lastChangeAt ?? null) : null,
    lastChangeType: !isNew ? (raw.lastChangeType ?? null) : null,
    lastStatus: !isNew ? (raw.lastStatus ?? 'never') : 'never',
    lastError: !isNew ? (raw.lastError ?? null) : null
  };
}

export function sanitizeStore(parsed: unknown): StoreData {
  if (!parsed || typeof parsed !== 'object') {
    return defaultStore();
  }

  const raw = parsed as Partial<StoreData>;
  const settingsRaw = (raw.settings || {}) as Partial<AppSettings>;

  const settings: AppSettings = {
    schemaVersion: sanitizeSchemaVersion(settingsRaw.schemaVersion),
    autoPollEnabled:
      typeof settingsRaw.autoPollEnabled === 'boolean' ? settingsRaw.autoPollEnabled : true,
    autoPollMinutes: sanitizeAutoPollMinutes(settingsRaw.autoPollMinutes),
    unseenUpdateCount: sanitizeUnseenUpdateCount(settingsRaw.unseenUpdateCount)
  };

  const sources = Array.isArray(raw.sources)
    ? raw.sources.map((source) => sanitizeSource(source, false)).filter(Boolean)
    : defaultSources();

  return {
    settings,
    sources: sources.length > 0 ? (sources as SourceRecord[]) : defaultSources()
  };
}

export function migrateStoreIfNeeded(store: StoreData): boolean {
  let changed = false;
  const currentVersion = sanitizeSchemaVersion(store.settings?.schemaVersion);

  if (currentVersion < 2) {
    const now = new Date().toISOString();

    const hasCodexSource = store.sources.some(
      (source) => source.url === 'https://developers.openai.com/codex/changelog/'
    );
    if (!hasCodexSource) {
      store.sources.push(createOpenAICodexSource(now));
      changed = true;
    }

    const windsurfSource = store.sources.find(
      (source) => source.url === 'https://windsurf.com/changelog'
    );
    if (windsurfSource && windsurfSource.regex === 'latest\\s+version\\s*([0-9][0-9.]+)') {
      windsurfSource.regex = '([0-9]+\\.[0-9]+\\.[0-9]+)';
      windsurfSource.notes = 'Extracts the first semantic version found in the changelog.';
      windsurfSource.updatedAt = now;
      changed = true;
    }
  }

  if (currentVersion < 3) {
    const unseenBefore = store.settings.unseenUpdateCount;
    store.settings.unseenUpdateCount = sanitizeUnseenUpdateCount(unseenBefore);
    if (store.settings.unseenUpdateCount !== unseenBefore) {
      changed = true;
    }
  }

  if (store.settings.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    store.settings.schemaVersion = CURRENT_SCHEMA_VERSION;
    changed = true;
  }

  return changed;
}

export function sourceWithComputedFlags(source: SourceRecord): SourceView {
  const isNew =
    source.lastChangeType === 'update' &&
    Boolean(source.lastChangeAt) &&
    Date.now() - Date.parse(source.lastChangeAt || '') <= TWO_HOURS_MS;

  return {
    ...source,
    isNew
  };
}

export function resetSourceRuntimeFields(source: SourceRecord): SourceRecord {
  return {
    ...source,
    lastValue: null,
    lastPolledAt: null,
    lastChangeAt: null,
    lastChangeType: null,
    lastStatus: 'never',
    lastError: null
  };
}

export function mergeSourceInput(existing: SourceRecord, input: SourceInput): SourceRecord | null {
  const merged: SourceRecord = {
    ...existing,
    ...input,
    id: existing.id
  };

  const sanitized = sanitizeSource(merged, false);
  if (!sanitized) {
    return null;
  }

  const parsingConfigChanged =
    existing.url !== sanitized.url ||
    existing.type !== sanitized.type ||
    existing.jsonPath !== sanitized.jsonPath ||
    existing.selector !== sanitized.selector ||
    existing.attribute !== sanitized.attribute ||
    existing.regex !== sanitized.regex;

  if (parsingConfigChanged) {
    return resetSourceRuntimeFields(sanitized);
  }

  return sanitized;
}
