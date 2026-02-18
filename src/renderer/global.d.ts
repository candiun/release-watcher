import type { ReleaseTrackerApi } from '../shared/types';

declare global {
  interface Window {
    releaseTrackerApi: ReleaseTrackerApi;
  }
}

export {};
