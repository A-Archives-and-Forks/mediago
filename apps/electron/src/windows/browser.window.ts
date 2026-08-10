import { provide } from "@inversifyjs/binding-decorators";
import isDev from "electron-is-dev";
import { inject, injectable } from "inversify";
import _ from "lodash";
import Window from "../core/window";
import { DownloaderServer } from "../services/downloader.server";
import GoConfigCache from "../services/go-config-cache";
import { defaultScheme, preloadUrl } from "../utils";
import ElectronLogger from "../vendor/ElectronLogger";
import ElectronStore from "../vendor/ElectronStore";

@injectable()
@provide()
export default class BrowserWindow extends Window {
  private suppressCloseSync = false;

  url = isDev
    ? "http://localhost:8500/browser"
    : `${defaultScheme}://index.html/browser`;

  constructor(
    @inject(ElectronStore)
    private readonly store: ElectronStore,
    @inject(GoConfigCache)
    private readonly configCache: GoConfigCache,
    @inject(DownloaderServer)
    private readonly downloaderServer: DownloaderServer,
    @inject(ElectronLogger)
    private readonly logger: ElectronLogger,
  ) {
    super({
      width: 1100,
      minWidth: 600,
      height: 680,
      minHeight: 680,
      show: false,
      frame: true,
      webPreferences: {
        preload: preloadUrl,
        spellcheck: false,
      },
    });

    this.configCache.onDidChange("openInNewWindow", this.handleNewWindowsVal);
  }

  handleNewWindowsVal = (newValue: unknown) => {
    if (!this.window) return;

    // Send notifications to all Windows
    if (newValue === false) {
      if (this.window && !this.window.isDestroyed()) {
        this.suppressCloseSync = true;
        this.window.close();
      }
    }
  };

  handleResize = () => {
    if (!this.window) return;

    const bounds = this.window.getBounds();
    this.store.set("browserBounds", _.omit(bounds, ["x", "y"]));
  };

  showWindow = () => {
    if (!this.window) {
      this.window = this.create();
      this.window.on("resized", this.handleResize);
    }

    this.window.show();
    if (isDev && process.env.OPEN_DEVTOOLS === "true") {
      this.window.webContents.openDevTools();
    }

    const browserBounds = this.store.get("browserBounds");
    if (browserBounds) {
      this.window.setBounds(browserBounds);
    }
  };

  hideWindow = () => {
    if (!this.window) return;

    this.suppressCloseSync = true;
    this.window.close();
  };

  windowClose = () => {
    const shouldSyncMode = !this.suppressCloseSync;
    this.suppressCloseSync = false;
    this.window = null;

    if (!shouldSyncMode) return;

    const client = this.downloaderServer.getClient();
    void client.setConfigKey("openInNewWindow", false).catch((error) => {
      this.logger.error(
        "[BrowserWindow] Failed to restore embedded browser mode:",
        error,
      );
    });
  };

  send(channel: string, ...args: unknown[]) {
    if (!this.window) return;

    this.window.webContents.send(channel, ...args);
  }
}
