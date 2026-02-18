import { randomUUID } from 'node:crypto';
import { CURRENT_SCHEMA_VERSION } from '../constants';
import type { SourceRecord, StoreData } from '../../shared/types';

function baseSource(
  now: string
): Omit<
  SourceRecord,
  | 'id'
  | 'name'
  | 'url'
  | 'type'
  | 'outputSelector'
  | 'requestHeaders'
  | 'selector'
  | 'attribute'
  | 'regex'
  | 'notes'
> {
  return {
    createdAt: now,
    updatedAt: now,
    lastValue: null,
    lastFingerprint: null,
    lastPolledAt: null,
    lastChangeAt: null,
    lastChangeType: null,
    lastStatus: 'never',
    lastError: null,
  };
}

export function createWindsurfSource(now: string): SourceRecord {
  return {
    id: randomUUID(),
    name: 'Windsurf Changelog',
    url: 'https://windsurf.com/changelog',
    type: 'html',
    outputSelector: '',
    requestHeaders: '',
    selector: 'body',
    attribute: '',
    regex: '([0-9]+\\.[0-9]+\\.[0-9]+)',
    notes: 'Extracts the first semantic version found in the changelog.',
    ...baseSource(now),
  };
}

export function createOpenAICodexSource(now: string): SourceRecord {
  return {
    id: randomUUID(),
    name: 'OpenAI Codex Changelog',
    url: 'https://developers.openai.com/codex/changelog/',
    type: 'html',
    outputSelector: '',
    requestHeaders: '',
    selector: 'body',
    attribute: '',
    regex: 'Codex CLI\\s+([0-9]+\\.[0-9]+\\.[0-9]+)',
    notes: 'Extracts the first Codex CLI version listed on the changelog page.',
    ...baseSource(now),
  };
}

export function createXcodeSource(now: string): SourceRecord {
  return {
    id: randomUUID(),
    name: 'Xcode Releases JSON',
    url: 'https://xcodereleases.com/data.json',
    type: 'json',
    outputSelector: '0.name',
    requestHeaders: '',
    selector: '',
    attribute: '',
    regex: '',
    notes: 'Adjust output selector if you want a different field.',
    ...baseSource(now),
  };
}

export function defaultSources(): SourceRecord[] {
  const now = new Date().toISOString();
  return [createWindsurfSource(now), createOpenAICodexSource(now), createXcodeSource(now)];
}

export function defaultStore(): StoreData {
  return {
    settings: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      autoPollEnabled: true,
      autoPollMinutes: 30,
      unseenUpdateCount: 0,
    },
    sources: defaultSources(),
  };
}
