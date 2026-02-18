import path from 'node:path';
import fs from 'node:fs/promises';
import type { App } from 'electron';
import { LEGACY_STORE_FILE, SHARED_CONFIG_DIR_NAME, STORE_FILE } from '../constants';
import { parseYaml, stringifyYaml } from '../yaml-compat';
import { defaultStore } from './defaults';
import { migrateStoreIfNeeded, sanitizeStore } from './sanitize';
import type { StoreData } from '../../shared/types';

export class StoreService {
  private readonly appRef: App;
  private storePath: string | null = null;
  private store: StoreData | null = null;

  constructor(appRef: App) {
    this.appRef = appRef;
  }

  private configDirectoryPath(): string {
    if (process.platform === 'darwin') {
      return path.join(
        this.appRef.getPath('home'),
        'Library',
        'Application Support',
        SHARED_CONFIG_DIR_NAME
      );
    }

    return path.join(this.appRef.getPath('appData'), SHARED_CONFIG_DIR_NAME);
  }

  private legacyStorePath(): string {
    return path.join(this.appRef.getPath('userData'), LEGACY_STORE_FILE);
  }

  private ensureStorePath(): string {
    if (!this.storePath) {
      this.storePath = path.join(this.configDirectoryPath(), STORE_FILE);
    }
    return this.storePath;
  }

  async load(): Promise<StoreData> {
    if (this.store) {
      return this.store;
    }

    const storePath = this.ensureStorePath();
    const legacyPath = this.legacyStorePath();

    let loadedFromLegacy = false;
    let createdDefaultStore = false;

    try {
      const raw = await fs.readFile(storePath, 'utf8');
      this.store = sanitizeStore(parseYaml(raw));
    } catch {
      try {
        const legacyRaw = await fs.readFile(legacyPath, 'utf8');
        this.store = sanitizeStore(JSON.parse(legacyRaw) as unknown);
        loadedFromLegacy = true;
      } catch {
        this.store = defaultStore();
        createdDefaultStore = true;
      }
    }

    const migrated = migrateStoreIfNeeded(this.store);
    if (loadedFromLegacy || createdDefaultStore || migrated) {
      await this.persist();
    }

    return this.store;
  }

  getSnapshot(): StoreData {
    if (!this.store) {
      throw new Error('Store is not loaded.');
    }
    return this.store;
  }

  async persist(): Promise<void> {
    if (!this.store) {
      throw new Error('Store is not loaded.');
    }

    const storePath = this.ensureStorePath();
    await fs.mkdir(path.dirname(storePath), { recursive: true });

    const tmpPath = `${storePath}.tmp`;
    await fs.writeFile(tmpPath, stringifyYaml(this.store), 'utf8');
    await fs.rename(tmpPath, storePath);
  }

  async update(mutator: (store: StoreData) => void | Promise<void>): Promise<StoreData> {
    const loaded = await this.load();
    await mutator(loaded);
    await this.persist();
    return loaded;
  }
}
