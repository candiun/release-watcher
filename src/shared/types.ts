export type SourceType = 'json' | 'html';

export type SourceChangeType = 'baseline' | 'update' | null;

export type SourceStatus = 'never' | 'ok' | 'error';

export interface SourceRecord {
  id: string;
  name: string;
  url: string;
  type: SourceType;
  outputSelector: string;
  requestHeaders: string;
  selector: string;
  attribute: string;
  regex: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  lastValue: string | null;
  lastFingerprint: string | null;
  lastPolledAt: string | null;
  lastChangeAt: string | null;
  lastChangeType: SourceChangeType;
  lastStatus: SourceStatus;
  lastError: string | null;
}

export interface SourceView extends SourceRecord {
  isNew: boolean;
}

export interface AppSettings {
  schemaVersion: number;
  autoPollEnabled: boolean;
  autoPollMinutes: number;
  unseenUpdateCount: number;
}

export interface StoreData {
  settings: AppSettings;
  sources: SourceRecord[];
}

export interface SourceInput {
  id?: string | null;
  name: string;
  url: string;
  type: SourceType;
  outputSelector?: string;
  requestHeaders?: string;
  selector?: string;
  attribute?: string;
  regex?: string;
  notes?: string;
}

export interface SettingsUpdate {
  autoPollEnabled?: boolean;
  autoPollMinutes?: number;
}

export interface ReleaseTrackerApi {
  listSources: () => Promise<SourceView[]>;
  saveSource: (source: SourceInput) => Promise<SourceView[]>;
  deleteSource: (sourceId: string) => Promise<SourceView[]>;
  pollSource: (sourceId: string) => Promise<SourceView[]>;
  pollAll: () => Promise<SourceView[]>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: SettingsUpdate) => Promise<AppSettings>;
}
