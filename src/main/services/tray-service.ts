import { Menu, Tray, nativeImage, type App, type NativeImage } from 'electron';

interface TrayServiceOptions {
  appRef: App;
  getUnseenCount: () => number;
  showMainWindow: () => Promise<void>;
  pollAll: () => Promise<void>;
  onQuit: () => void;
}

interface TrayIcons {
  normal: NativeImage;
  badged: NativeImage;
}

export class TrayService {
  private readonly appRef: App;
  private readonly getUnseenCount: () => number;
  private readonly showMainWindow: () => Promise<void>;
  private readonly pollAll: () => Promise<void>;
  private readonly onQuit: () => void;

  private tray: Tray | null = null;
  private trayIcons: TrayIcons | null = null;

  constructor(options: TrayServiceOptions) {
    this.appRef = options.appRef;
    this.getUnseenCount = options.getUnseenCount;
    this.showMainWindow = options.showMainWindow;
    this.pollAll = options.pollAll;
    this.onQuit = options.onQuit;
  }

  createTray(): void {
    if (process.platform !== 'darwin' || this.tray) {
      return;
    }

    this.trayIcons = {
      normal: this.createTrayIcon(),
      badged: this.createTrayIcon({ badged: true })
    };

    this.tray = new Tray(this.trayIcons.normal);
    this.tray.setIgnoreDoubleClickEvents(true);

    if (typeof this.tray.setTitle === 'function') {
      this.tray.setTitle('RW');
    }

    this.tray.on('click', () => {
      this.showMainWindow().catch((error) => {
        console.error('Failed to show window:', error);
      });
    });

    this.updateIndicator();
  }

  updateIndicator(): void {
    const unseenCount = this.getUnseenCount();

    if (process.platform === 'darwin' && this.appRef.dock && typeof this.appRef.dock.setBadge === 'function') {
      this.appRef.dock.setBadge(unseenCount > 0 ? String(unseenCount) : '');
    }

    if (!this.tray) {
      return;
    }

    if (!this.trayIcons) {
      this.trayIcons = {
        normal: this.createTrayIcon(),
        badged: this.createTrayIcon({ badged: true })
      };
    }

    this.tray.setImage(unseenCount > 0 ? this.trayIcons.badged : this.trayIcons.normal);

    if (process.platform === 'darwin' && typeof this.tray.setTitle === 'function') {
      this.tray.setTitle(this.trayTitleForCount(unseenCount));
    }

    this.tray.setToolTip(
      unseenCount > 0
        ? `Release Watcher (${unseenCount} unseen update${unseenCount === 1 ? '' : 's'})`
        : 'Release Watcher'
    );

    this.tray.setContextMenu(this.buildTrayMenu(unseenCount));
  }

  private trayTitleForCount(unseenCount: number): string {
    if (unseenCount > 0) {
      return unseenCount > 9 ? 'RW •9+' : `RW •${unseenCount}`;
    }
    return 'RW';
  }

  private buildTrayMenu(unseenCount: number): Menu {
    const unseenLabel =
      unseenCount > 0
        ? `${unseenCount} unseen update${unseenCount === 1 ? '' : 's'}`
        : 'No unseen updates';

    return Menu.buildFromTemplate([
      {
        label: 'Open Release Watcher',
        click: () => {
          this.showMainWindow().catch((error) => {
            console.error('Failed to show window:', error);
          });
        }
      },
      {
        label: 'Poll All Sources',
        click: () => {
          this.pollAll().catch((error) => {
            console.error('Tray poll failed:', error);
          });
        }
      },
      { type: 'separator' },
      { label: unseenLabel, enabled: false },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this.onQuit();
        }
      }
    ]);
  }

  private createTrayIcon(options: { badged?: boolean } = {}): NativeImage {
    const badge = options.badged ? '<circle cx="14.5" cy="3.5" r="3" fill="black" />' : '';
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">',
      '<rect x="2" y="3" width="14" height="11" rx="2" ry="2" fill="black" />',
      '<rect x="4" y="5" width="10" height="2" rx="1" fill="white" />',
      '<rect x="4" y="8" width="7" height="2" rx="1" fill="white" />',
      badge,
      '</svg>'
    ].join('');

    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    const icon = nativeImage.createFromDataURL(dataUrl).resize({ width: 18, height: 18 });
    icon.setTemplateImage(true);
    return icon;
  }
}
