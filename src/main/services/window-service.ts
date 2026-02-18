import path from 'node:path';
import { BrowserWindow, type App } from 'electron';

interface WindowServiceOptions {
  appRef: App;
  onWindowVisible: () => Promise<void>;
  shouldHideOnClose: () => boolean;
}

export class WindowService {
  private readonly appRef: App;
  private mainWindow: BrowserWindow | null = null;
  private readonly onWindowVisible: () => Promise<void>;
  private readonly shouldHideOnClose: () => boolean;

  constructor(options: WindowServiceOptions) {
    this.appRef = options.appRef;
    this.onWindowVisible = options.onWindowVisible;
    this.shouldHideOnClose = options.shouldHideOnClose;
  }

  getWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  isVisible(): boolean {
    return Boolean(
      this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isVisible()
    );
  }

  async createWindow(): Promise<BrowserWindow> {
    this.mainWindow = new BrowserWindow({
      width: 1220,
      height: 860,
      minWidth: 980,
      minHeight: 640,
      title: 'Release Watcher',
      webPreferences: {
        preload: path.join(__dirname, '..', '..', 'preload', 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    if (process.platform === 'darwin') {
      this.mainWindow.on('close', (event) => {
        if (this.shouldHideOnClose()) {
          event.preventDefault();
          this.mainWindow?.hide();
          this.appRef.dock?.hide();
        }
      });
    }

    this.mainWindow.on('show', () => {
      this.onWindowVisible().catch((error) => {
        console.error('Failed to handle window visible event:', error);
      });
    });

    this.mainWindow.on('focus', () => {
      this.onWindowVisible().catch((error) => {
        console.error('Failed to handle window focus event:', error);
      });
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    await this.mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));

    return this.mainWindow;
  }

  async showMainWindow(): Promise<void> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      await this.createWindow();
    }

    if (!this.mainWindow) {
      return;
    }

    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }

    await this.appRef.dock?.show();
    this.mainWindow.show();
    this.mainWindow.focus();

    await this.onWindowVisible();
  }
}
