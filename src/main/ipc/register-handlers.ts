import { ipcMain } from 'electron';
import {
  mergeSourceInput,
  sanitizeAutoPollMinutes,
  sanitizeSource,
  sourceWithComputedFlags,
} from '../store/sanitize';
import type { PollingService } from '../services/polling-service';
import type { StoreService } from '../store/store-service';
import type { SettingsUpdate, SourceInput, SourceView } from '../../shared/types';

interface RegisterHandlersOptions {
  storeService: StoreService;
  pollingService: PollingService;
  onSettingsChanged: () => void;
  onStoreMutated: () => void;
}

export function registerIpcHandlers(options: RegisterHandlersOptions): void {
  const { storeService, pollingService, onSettingsChanged, onStoreMutated } = options;

  ipcMain.handle('sources:list', async (): Promise<SourceView[]> => {
    const store = await storeService.load();
    return store.sources.map(sourceWithComputedFlags);
  });

  ipcMain.handle('settings:get', async () => {
    const store = await storeService.load();
    return store.settings;
  });

  ipcMain.handle('settings:update', async (_event, partialSettings: SettingsUpdate) => {
    const store = await storeService.load();

    if (typeof partialSettings.autoPollEnabled === 'boolean') {
      store.settings.autoPollEnabled = partialSettings.autoPollEnabled;
    }

    if (partialSettings.autoPollMinutes !== undefined) {
      store.settings.autoPollMinutes = sanitizeAutoPollMinutes(partialSettings.autoPollMinutes);
    }

    await storeService.persist();
    onSettingsChanged();
    onStoreMutated();

    return store.settings;
  });

  ipcMain.handle('source:save', async (_event, sourceInput: SourceInput) => {
    const store = await storeService.load();
    const existingIndex = store.sources.findIndex((item) => item.id === sourceInput.id);

    if (existingIndex >= 0) {
      const existing = store.sources[existingIndex];
      if (!existing) {
        throw new Error('Source not found.');
      }
      const merged = mergeSourceInput(existing, sourceInput);
      if (!merged) {
        throw new Error('Invalid source data.');
      }
      store.sources[existingIndex] = merged;
    } else {
      const sanitized = sanitizeSource(sourceInput, true);
      if (!sanitized) {
        throw new Error('Invalid source data.');
      }
      store.sources.push(sanitized);
    }

    await storeService.persist();
    onStoreMutated();

    return store.sources.map(sourceWithComputedFlags);
  });

  ipcMain.handle('source:delete', async (_event, sourceId: string) => {
    const store = await storeService.load();

    const beforeCount = store.sources.length;
    store.sources = store.sources.filter((item) => item.id !== sourceId);

    if (store.sources.length === beforeCount) {
      throw new Error('Source not found.');
    }

    await storeService.persist();
    onStoreMutated();

    return store.sources.map(sourceWithComputedFlags);
  });

  ipcMain.handle('poll:source', async (_event, sourceId: string) => {
    await storeService.load();

    await pollingService.withPollLock(async () => {
      await pollingService.pollSourceById(sourceId);
      await storeService.persist();
      onStoreMutated();
    });

    const store = storeService.getSnapshot();
    return store.sources.map(sourceWithComputedFlags);
  });

  ipcMain.handle('poll:all', async () => {
    await storeService.load();

    await pollingService.withPollLock(async () => {
      await pollingService.pollAllSources();
      onStoreMutated();
    });

    const store = storeService.getSnapshot();
    return store.sources.map(sourceWithComputedFlags);
  });
}
