import { app } from 'electron';
import { registerIpcHandlers } from './ipc/register-handlers';
import { PollingService } from './services/polling-service';
import { TrayService } from './services/tray-service';
import { WindowService } from './services/window-service';
import { StoreService } from './store/store-service';
import { sanitizeUnseenUpdateCount } from './store/sanitize';

const storeService = new StoreService(app);

let isQuitting = false;
let autoPollTimer: NodeJS.Timeout | null = null;

let windowService: WindowService;
let pollingService: PollingService;
let trayService: TrayService;

function currentUnseenUpdateCount(): number {
  const store = storeService.getSnapshot();
  const count = sanitizeUnseenUpdateCount(store.settings.unseenUpdateCount);
  store.settings.unseenUpdateCount = count;
  return count;
}

function onStoreMutated(): void {
  if (trayService) {
    trayService.updateIndicator();
  }
}

function markUnseenUpdate(): void {
  const store = storeService.getSnapshot();
  store.settings.unseenUpdateCount = currentUnseenUpdateCount() + 1;
  onStoreMutated();
}

async function clearUnseenUpdates(): Promise<void> {
  const store = storeService.getSnapshot();
  const unseenCount = currentUnseenUpdateCount();

  if (unseenCount === 0) {
    return;
  }

  store.settings.unseenUpdateCount = 0;
  onStoreMutated();
  await storeService.persist();
}

function scheduleAutoPoll(): void {
  if (autoPollTimer) {
    clearInterval(autoPollTimer);
    autoPollTimer = null;
  }

  const store = storeService.getSnapshot();
  const { autoPollEnabled, autoPollMinutes } = store.settings;

  if (!autoPollEnabled) {
    return;
  }

  autoPollTimer = setInterval(() => {
    pollingService
      .withPollLock(async () => {
        await pollingService.pollAllSources();
      })
      .catch((error) => {
        console.error('Auto-poll failed:', error);
      });
  }, autoPollMinutes * 60 * 1000);
}

async function pollAllFromTray(): Promise<void> {
  await pollingService.withPollLock(async () => {
    await pollingService.pollAllSources();
  });
}

function initializeServices(): void {
  windowService = new WindowService({
    onWindowVisible: clearUnseenUpdates,
    shouldHideOnClose: () => process.platform === 'darwin' && !isQuitting
  });

  pollingService = new PollingService({
    storeService,
    isMainWindowVisible: () => windowService.isVisible(),
    markUnseenUpdate,
    onStoreMutated
  });

  trayService = new TrayService({
    appRef: app,
    getUnseenCount: currentUnseenUpdateCount,
    showMainWindow: () => windowService.showMainWindow(),
    pollAll: pollAllFromTray,
    onQuit: () => {
      isQuitting = true;
      app.quit();
    }
  });

  registerIpcHandlers({
    storeService,
    pollingService,
    onSettingsChanged: scheduleAutoPoll,
    onStoreMutated
  });
}

app.whenReady().then(async () => {
  await storeService.load();
  initializeServices();

  trayService.createTray();
  scheduleAutoPoll();

  await windowService.createWindow();
  trayService.updateIndicator();

  app.on('activate', () => {
    windowService.showMainWindow().catch((error) => {
      console.error('Failed to show window:', error);
    });
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
