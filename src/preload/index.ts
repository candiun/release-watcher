import { contextBridge, ipcRenderer } from 'electron';
import type { ReleaseTrackerApi, SettingsUpdate, SourceInput } from '../shared/types';

const api: ReleaseTrackerApi = {
  listSources: () =>
    ipcRenderer.invoke('sources:list') as ReturnType<ReleaseTrackerApi['listSources']>,
  saveSource: (source: SourceInput) =>
    ipcRenderer.invoke('source:save', source) as ReturnType<ReleaseTrackerApi['saveSource']>,
  deleteSource: (sourceId: string) =>
    ipcRenderer.invoke('source:delete', sourceId) as ReturnType<ReleaseTrackerApi['deleteSource']>,
  pollSource: (sourceId: string) =>
    ipcRenderer.invoke('poll:source', sourceId) as ReturnType<ReleaseTrackerApi['pollSource']>,
  pollAll: () => ipcRenderer.invoke('poll:all') as ReturnType<ReleaseTrackerApi['pollAll']>,
  getSettings: () =>
    ipcRenderer.invoke('settings:get') as ReturnType<ReleaseTrackerApi['getSettings']>,
  updateSettings: (settings: SettingsUpdate) =>
    ipcRenderer.invoke('settings:update', settings) as ReturnType<
      ReleaseTrackerApi['updateSettings']
    >,
};

contextBridge.exposeInMainWorld('releaseTrackerApi', api);
