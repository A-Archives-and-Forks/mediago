import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { ElectronBlocker } from "@ghostery/adblocker-electron";
import { provide } from "@inversifyjs/binding-decorators";
import type {
  BridgeDiscoveryCompleteParams,
  BridgeDiscoveryRequest,
} from "@mediago/core-sdk";
import {
  type BrowserNavigationFailurePayload,
  type BrowserNavigationPayload,
  type BrowserSourceDetectedPayload,
  type BrowserTabSourceSnapshot,
  type BrowserTabSnapshot,
  type BrowserTabsSnapshot,
  DownloadType,
  type HLSMediaInfo,
  IpcEvent,
  mergeSniffedSource,
} from "@mediago/shared-common";
import {
  app,
  type Event,
  type HandlerDetails,
  session,
  WebContentsView,
} from "electron";
import isDev from "electron-is-dev";
import { inject, injectable } from "inversify";
import {
  isDeeplink,
  mobileUA,
  PERSIST_WEBVIEW,
  PRIVACY_WEBVIEW,
  pcUA,
  pluginUrl,
} from "../utils";
import ElectronLogger from "../vendor/ElectronLogger";
import BrowserWindow from "../windows/browser.window";
import MainWindow from "../windows/main.window";
import { AdBlockerLoader } from "./ad-blocker-loader";
import {
  type AdBlockerCacheValue,
  createAdBlockerCache,
  getAdBlockerCachePath,
} from "./ad-blocker-cache";
import {
  type DiscoveryBrowserExecutor,
  DiscoveryExecutorService,
} from "./discovery-executor.service";
import GoConfigCache from "./go-config-cache";
import {
  AgentCollectionError,
  type SniffingSourceEvent,
  SniffingHelper,
  type SourceParams,
} from "./sniffing-helper.service";
import { enableSessionProxy } from "./webview-proxy";

const require = createRequire(import.meta.url);
const preload = require.resolve("@mediago/electron-preload");

interface TabRuntime {
  attachedWindow: Electron.BrowserWindow | null;
  bounds: Electron.Rectangle | null;
  kind: "user" | "agent";
  partition: string;
  tabId: string;
  view: WebContentsView;
}

export interface CreateTabOptions {
  activate?: boolean;
  url?: string;
}

@injectable()
@provide()
export default class BrowserTabManagerService implements DiscoveryBrowserExecutor {
  private readonly tabs: BrowserTabSnapshot[] = [];
  private readonly runtimes = new Map<string, TabRuntime>();
  private readonly agentTabs = new Map<string, string>();
  private activeTabId = "";
  private sourcePanelCollapsed = false;
  private defaultPartition = PERSIST_WEBVIEW;
  private blocker?: ElectronBlocker;
  private blockerExpiresAt = Number.POSITIVE_INFINITY;
  private readonly blockerLoader: AdBlockerLoader<ElectronBlocker>;
  private readonly blockingSessions = new Set<Electron.Session>();
  private blockingRequested: boolean;

  constructor(
    @inject(MainWindow)
    private readonly mainWindow: MainWindow,
    @inject(ElectronLogger)
    private readonly logger: ElectronLogger,
    @inject(BrowserWindow)
    private readonly browserWindow: BrowserWindow,
    @inject(GoConfigCache)
    private readonly configCache: GoConfigCache,
    @inject(SniffingHelper)
    private readonly sniffingHelper: SniffingHelper,
    @inject(DiscoveryExecutorService)
    private readonly discoveryExecutor: DiscoveryExecutorService,
  ) {
    this.blockingRequested = Boolean(this.configCache.get("blockAds"));
    const blockerCache = createAdBlockerCache(
      getAdBlockerCachePath(app.getPath("userData")),
      () => this.logger.error("[AdBlocker] list load failed"),
    );
    this.blockerLoader = new AdBlockerLoader(
      async () => {
        const result = await blockerCache.load();
        this.blockerExpiresAt = result.refresh
          ? Number.POSITIVE_INFINITY
          : result.expiresAt;
        if (result.refresh) this.observeBlockerRefresh(result.refresh);
        return result.blocker;
      },
      () => this.logger.error("[AdBlocker] list load failed"),
    );

    this.defaultPartition = this.configCache.get("privacy")
      ? PRIVACY_WEBVIEW
      : PERSIST_WEBVIEW;
    this.sniffingHelper.on("source", this.onSource);
    this.discoveryExecutor.setBrowser(this);
    this.createTab();
    const { useProxy, proxy } = this.configCache.store;
    this.setProxy(useProxy, proxy);
  }

  getSnapshot(): BrowserTabsSnapshot {
    return structuredClone({
      tabs: this.tabs,
      activeTabId: this.activeTabId,
      sourcePanelCollapsed: this.sourcePanelCollapsed,
    });
  }

  getActiveTabId(): string {
    return this.activeTabId;
  }

  restoreSnapshot(snapshot: BrowserTabsSnapshot): BrowserTabsSnapshot {
    if (
      !snapshot ||
      !Array.isArray(snapshot.tabs) ||
      snapshot.tabs.length === 0
    ) {
      return this.getSnapshot();
    }
    for (const runtime of this.runtimes.values()) {
      if (runtime.kind === "user") this.destroyRuntime(runtime.tabId);
    }
    this.tabs.splice(
      0,
      this.tabs.length,
      ...snapshot.tabs
        .filter((tab) => tab.kind === "user" && typeof tab.id === "string")
        .map((tab) => this.sanitizeTabSnapshot(tab)),
    );
    if (this.tabs.length === 0) this.tabs.push(this.createHomeSnapshot());
    this.activeTabId = this.tabs.some((tab) => tab.id === snapshot.activeTabId)
      ? snapshot.activeTabId
      : this.tabs[0].id;
    this.sourcePanelCollapsed = snapshot.sourcePanelCollapsed === true;
    this.emitSnapshot();
    return this.getSnapshot();
  }

  createTab(options: CreateTabOptions = {}): BrowserTabSnapshot {
    const tab = this.createHomeSnapshot(options.url);
    this.tabs.push(tab);
    if (options.activate !== false || !this.activeTabId) {
      this.activateTab(tab.id);
    }
    this.emitSnapshot();
    return structuredClone(tab);
  }

  activateTab(tabId: string): BrowserTabsSnapshot {
    this.requireTab(tabId);
    if (this.activeTabId !== tabId) {
      this.detachRuntime(this.runtimes.get(this.activeTabId));
      this.activeTabId = tabId;
    }
    this.attachRuntime(this.runtimes.get(tabId));
    this.emitSnapshot();
    return this.getSnapshot();
  }

  closeTab(tabId: string): BrowserTabsSnapshot {
    const index = this.tabs.findIndex((tab) => tab.id === tabId);
    if (index < 0) return this.getSnapshot();
    const wasActive = this.activeTabId === tabId;
    this.destroyRuntime(tabId);
    this.tabs.splice(index, 1);
    if (this.tabs.length === 0) {
      const replacement = this.createHomeSnapshot();
      this.tabs.push(replacement);
      this.activeTabId = replacement.id;
    } else if (wasActive) {
      this.activeTabId = this.tabs[Math.min(index, this.tabs.length - 1)].id;
    }
    this.attachRuntime(this.runtimes.get(this.activeTabId));
    this.emitSnapshot();
    return this.getSnapshot();
  }

  async loadURL(tabId: string, url: string): Promise<void> {
    const tab = this.requireTab(tabId);
    tab.mode = "browser";
    tab.status = "loading";
    tab.url = url;
    tab.errorCode = undefined;
    tab.errorMessage = undefined;
    tab.sources = [];
    this.emitSnapshot();

    let runtime: TabRuntime;
    try {
      runtime = this.ensureUserRuntime(tabId);
    } catch {
      tab.status = "failed";
      tab.errorMessage = "Unable to allocate a browser tab";
      this.emitSnapshot();
      throw new Error("Unable to allocate a browser tab");
    }
    this.sniffingHelper.update(tabId, { title: tab.title, url });
    this.blockingRequested = Boolean(this.configCache.get("blockAds"));
    if (this.blockingRequested) this.startBlocking(runtime.partition);
    runtime.view.webContents.stop();
    await runtime.view.webContents.loadURL(url);
  }

  async goBack(tabId: string): Promise<boolean> {
    const runtime = this.runtimes.get(tabId);
    if (!runtime) return false;
    if (runtime.view.webContents.navigationHistory.canGoBack()) {
      runtime.view.webContents.navigationHistory.goBack();
      return true;
    }
    await this.goHome(tabId);
    return false;
  }

  async reload(tabId: string): Promise<void> {
    const runtime = this.runtimes.get(tabId);
    if (!runtime) throw new Error("Browser tab view not found");
    runtime.view.webContents.reload();
  }

  async goHome(tabId: string): Promise<void> {
    const tab = this.requireTab(tabId);
    this.destroyRuntime(tabId);
    Object.assign(tab, {
      mode: "home" as const,
      status: "default" as const,
      url: "",
      title: "",
      favicon: undefined,
      errorCode: undefined,
      errorMessage: undefined,
      sources: [],
    });
    this.emitSnapshot();
  }

  setBounds(tabId: string, bounds: Electron.Rectangle): void {
    const runtime = this.runtimes.get(tabId);
    if (!runtime) return;
    runtime.bounds = bounds;
    runtime.view.setBounds(bounds);
    this.attachRuntime(runtime);
  }

  show(tabId: string): void {
    if (tabId !== this.activeTabId) return;
    this.attachRuntime(this.runtimes.get(tabId));
  }

  hide(tabId: string): void {
    this.detachRuntime(this.runtimes.get(tabId));
  }

  reparentActiveView(): void {
    const runtime = this.runtimes.get(this.activeTabId);
    if (!runtime) return;
    this.detachRuntime(runtime);
    this.attachRuntime(runtime);
  }

  setSourcePanelCollapsed(collapsed: boolean): void {
    this.sourcePanelCollapsed = collapsed;
    this.emitSnapshot();
  }

  setAudioMuted(audioMuted?: boolean): void {
    for (const runtime of this.runtimes.values()) {
      runtime.view.webContents.setAudioMuted(audioMuted === true);
    }
  }

  setUserAgent(isMobile?: boolean): void {
    const userAgent = isMobile ? mobileUA : pcUA;
    for (const runtime of this.runtimes.values()) {
      runtime.view.webContents.setUserAgent(userAgent);
    }
  }

  setProxy(useProxy: boolean, proxy: string): void {
    for (const partition of this.runtimePartitions(true)) {
      const targetSession = session.fromPartition(partition);
      if (useProxy) {
        enableSessionProxy(targetSession, this.logger, proxy);
      } else {
        void targetSession.setProxy({ proxyRules: "" });
      }
    }
  }

  setBlocking(enableBlocking: boolean): void {
    this.blockingRequested = enableBlocking;
    if (!enableBlocking) {
      this.disableBlocking();
      return;
    }
    for (const partition of this.runtimePartitions(true)) {
      this.startBlocking(partition);
    }
  }

  async clearCache(): Promise<void> {
    await Promise.all(
      [...this.runtimePartitions(true)].map(async (partition) => {
        const targetSession = session.fromPartition(partition);
        await targetSession.clearCache();
        await targetSession.clearStorageData();
      }),
    );
  }

  setDefaultSession(isPrivacy = false, init = false): void {
    this.defaultPartition = isPrivacy ? PRIVACY_WEBVIEW : PERSIST_WEBVIEW;
    for (const runtime of this.runtimes.values()) {
      if (runtime.kind === "user") this.destroyRuntime(runtime.tabId);
    }
    for (const tab of this.tabs) {
      Object.assign(tab, {
        mode: "home" as const,
        status: "default" as const,
        url: "",
        title: "",
        sources: [],
        errorCode: undefined,
        errorMessage: undefined,
      });
    }
    const { useProxy, proxy } = this.configCache.store;
    this.setProxy(useProxy, proxy);
    this.emitSnapshot();
    if (!init) this.sendToCurrentWindow(IpcEvent.browser.privacyChanged);
  }

  async withBilibiliSessionCookies<
    T extends Pick<SourceParams, "type" | "headers">,
  >(tabId: string, item: T): Promise<T> {
    if (item.type !== DownloadType.bilibili || hasCookieHeader(item.headers)) {
      return item;
    }
    const partition =
      this.runtimes.get(tabId)?.partition ?? this.defaultPartition;
    const cookies = await session.fromPartition(partition).cookies.get({
      url: "https://www.bilibili.com",
    });
    if (cookies.length === 0) return item;
    const cookieHeader = cookies
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");
    return {
      ...item,
      headers: [item.headers, `Cookie:${cookieHeader}`]
        .filter(Boolean)
        .join("\n"),
    };
  }

  async captureView(tabId: string): Promise<Electron.NativeImage | null> {
    const runtime = this.runtimes.get(tabId);
    if (!runtime) throw new Error("Browser tab view not found");
    if (!runtime.attachedWindow) return null;
    return runtime.view.webContents.capturePage();
  }

  async discover(
    request: BridgeDiscoveryRequest,
    signal: AbortSignal,
  ): Promise<BridgeDiscoveryCompleteParams> {
    if (this.agentTabs.has(request.discoveryId)) {
      throw new Error("Discovery is already running");
    }
    const tabId = `agent-${request.discoveryId}`;
    const partition = request.input.useSessionCookies
      ? this.defaultPartition
      : `agent-${request.discoveryId}`;
    const runtime = this.createRuntime(
      tabId,
      "agent",
      partition,
      request.input.useSessionCookies,
      request.input.url,
    );
    this.agentTabs.set(request.discoveryId, tabId);
    const collection = this.sniffingHelper.collectAgent(tabId, {
      signal,
      timeoutMs: request.input.timeoutMs,
    });
    try {
      const navigation = runtime.view.webContents.loadURL(request.input.url);
      await Promise.race([navigation, collection.then(() => undefined)]);
      return await collection;
    } catch (error) {
      if (error instanceof AgentCollectionError) throw error;
      this.sniffingHelper.failAgent(tabId, "discovery_navigation_failed");
      await collection.catch(() => undefined);
      throw new AgentCollectionError(
        "discovery_navigation_failed",
        "browser navigation failed",
      );
    } finally {
      this.agentTabs.delete(request.discoveryId);
      this.destroyRuntime(tabId);
    }
  }

  async cancel(discoveryId: string): Promise<void> {
    const tabId = this.agentTabs.get(discoveryId);
    if (!tabId) return;
    this.sniffingHelper.cancelAgent(tabId);
    this.destroyRuntime(tabId);
    this.agentTabs.delete(discoveryId);
  }

  destroy(): void {
    this.discoveryExecutor.setBrowser(null);
    for (const tabId of this.runtimes.keys()) this.destroyRuntime(tabId);
    this.sniffingHelper.off("source", this.onSource);
    this.disableBlocking();
  }

  private createHomeSnapshot(url = ""): BrowserTabSnapshot {
    return {
      id: randomUUID(),
      kind: "user",
      mode: url ? "browser" : "home",
      status: url ? "loading" : "default",
      url,
      title: "",
      sources: [],
    };
  }

  private sanitizeTabSnapshot(tab: BrowserTabSnapshot): BrowserTabSnapshot {
    return {
      id: tab.id,
      kind: "user",
      mode: tab.mode === "browser" ? "browser" : "home",
      status: ["loading", "loaded", "failed"].includes(tab.status)
        ? tab.status
        : "default",
      url: typeof tab.url === "string" ? tab.url : "",
      title: typeof tab.title === "string" ? tab.title : "",
      favicon: typeof tab.favicon === "string" ? tab.favicon : undefined,
      errorCode: typeof tab.errorCode === "number" ? tab.errorCode : undefined,
      errorMessage:
        typeof tab.errorMessage === "string" ? tab.errorMessage : undefined,
      sources: Array.isArray(tab.sources)
        ? tab.sources.map((source) => this.sanitizeSourceSnapshot(source))
        : [],
    };
  }

  private sanitizeSourceSnapshot(
    source: BrowserTabSourceSnapshot,
  ): BrowserTabSourceSnapshot {
    const mediaInfo: HLSMediaInfo | undefined = source.mediaInfo
      ? {
          status: source.mediaInfo.status,
          playlistType: source.mediaInfo.playlistType,
          maxQuality: source.mediaInfo.maxQuality,
          variants: source.mediaInfo.variants.map((variant) => ({
            url: variant.url,
            quality: variant.quality,
            width: variant.width,
            height: variant.height,
            bandwidth: variant.bandwidth,
            codecs: variant.codecs,
          })),
        }
      : undefined;
    return {
      id: source.id,
      url: source.url,
      documentURL: source.documentURL,
      name: source.name,
      type: source.type,
      mediaInfo,
    };
  }

  private requireTab(tabId: string): BrowserTabSnapshot {
    const tab = this.tabs.find((candidate) => candidate.id === tabId);
    if (!tab) throw new Error(`Browser tab ${tabId} was not found`);
    return tab;
  }

  private ensureUserRuntime(tabId: string): TabRuntime {
    const existing = this.runtimes.get(tabId);
    if (existing) return existing;
    return this.createRuntime(tabId, "user", this.defaultPartition, true);
  }

  private createRuntime(
    tabId: string,
    kind: "user" | "agent",
    partition: string,
    useSessionCookies: boolean,
    initialURL = "",
  ): TabRuntime {
    const view = new WebContentsView({
      webPreferences: { partition, preload },
    });
    const runtime: TabRuntime = {
      attachedWindow: null,
      bounds: null,
      kind,
      partition,
      tabId,
      view,
    };
    this.runtimes.set(tabId, runtime);
    this.sniffingHelper.register({
      initialPageInfo: { title: "", url: initialURL },
      kind,
      partition,
      tabId,
      useSessionCookies,
      webContentsId: view.webContents.id,
    });
    this.bindRuntime(runtime);
    view.setBackgroundColor("#fff");
    view.webContents.setAudioMuted(this.configCache.get("audioMuted") === true);
    view.webContents.setUserAgent(
      this.configCache.get("isMobile") ? mobileUA : pcUA,
    );
    this.applyProxyToPartition(partition);
    if (this.blockingRequested) this.startBlocking(partition);
    if (isDev && process.env.OPEN_DEVTOOLS === "true" && kind === "user") {
      view.webContents.openDevTools();
    }
    if (kind === "user" && tabId === this.activeTabId)
      this.attachRuntime(runtime);
    return runtime;
  }

  private bindRuntime(runtime: TabRuntime): void {
    const { webContents } = runtime.view;
    webContents.on("dom-ready", () => this.onDomReady(runtime));
    webContents.on("did-navigate", () => void this.onDidNavigate(runtime));
    webContents.on("did-navigate-in-page", () =>
      this.onDidNavigateInPage(runtime),
    );
    webContents.on("did-fail-load", (_event, code, description) =>
      this.onDidFailLoad(runtime, code, description),
    );
    webContents.on("page-title-updated", () =>
      this.onPageTitleUpdated(runtime),
    );
    webContents.on("page-favicon-updated", (_event, favicons: string[]) =>
      this.onFaviconUpdated(runtime, favicons),
    );
    webContents.on("will-navigate", (event: Event, url: string) => {
      if (isDeeplink(url)) event.preventDefault();
    });
    webContents.setWindowOpenHandler(({ url }: HandlerDetails) => {
      if (runtime.kind === "user") {
        const tab = this.createTab({ url });
        void this.loadURL(tab.id, url);
      }
      return { action: "deny" };
    });
  }

  private onDomReady(runtime: TabRuntime): void {
    if (!this.isCurrentRuntime(runtime)) return;
    const pageInfo = this.pageInfo(runtime);
    this.sniffingHelper.update(runtime.tabId, pageInfo);
    this.sniffingHelper.markDomReady(runtime.tabId);
    if (runtime.kind === "user") {
      this.updateTabPage(runtime.tabId, pageInfo);
      this.sendRuntime(runtime, IpcEvent.browser.domReady, {
        tabId: runtime.tabId,
        ...pageInfo,
      } satisfies BrowserNavigationPayload);
    }
  }

  private async onDidNavigate(runtime: TabRuntime): Promise<void> {
    if (!this.isCurrentRuntime(runtime)) return;
    const pageInfo = this.pageInfo(runtime);
    this.sniffingHelper.update(runtime.tabId, pageInfo);
    if (runtime.kind === "user") {
      this.updateTabPage(runtime.tabId, pageInfo, "loaded");
      this.sendRuntime(runtime, IpcEvent.browser.didNavigate, {
        tabId: runtime.tabId,
        ...pageInfo,
      } satisfies BrowserNavigationPayload);
    }
    try {
      const content = await readFile(pluginUrl, "utf-8");
      if (this.isCurrentRuntime(runtime)) {
        await runtime.view.webContents.executeJavaScript(content);
      }
    } catch {
      // Page plugin injection is best-effort.
    }
    if (this.isCurrentRuntime(runtime)) {
      this.sniffingHelper.checkPageInfo(runtime.tabId);
    }
  }

  private onDidNavigateInPage(runtime: TabRuntime): void {
    if (!this.isCurrentRuntime(runtime)) return;
    const pageInfo = this.pageInfo(runtime);
    this.sniffingHelper.update(runtime.tabId, pageInfo);
    this.sniffingHelper.checkPageInfo(runtime.tabId);
    if (runtime.kind === "user") {
      this.updateTabPage(runtime.tabId, pageInfo, "loaded");
      this.sendRuntime(runtime, IpcEvent.browser.didNavigateInPage, {
        tabId: runtime.tabId,
        ...pageInfo,
      } satisfies BrowserNavigationPayload);
    }
  }

  private onDidFailLoad(
    runtime: TabRuntime,
    errorCode: number,
    errorMessage: string,
  ): void {
    if (!this.isCurrentRuntime(runtime)) return;
    if (runtime.kind === "agent") {
      this.sniffingHelper.failAgent(
        runtime.tabId,
        "discovery_navigation_failed",
      );
      return;
    }
    const pageInfo = this.pageInfo(runtime);
    const tab = this.requireTab(runtime.tabId);
    Object.assign(tab, {
      status: "failed" as const,
      errorCode,
      errorMessage,
      ...pageInfo,
    });
    this.emitSnapshot();
    this.sendRuntime(runtime, IpcEvent.browser.didFailLoad, {
      tabId: runtime.tabId,
      ...pageInfo,
      errorCode,
      errorMessage,
    } satisfies BrowserNavigationFailurePayload);
    this.logger.error(`[BrowserTab] load failed (${errorCode})`);
  }

  private onPageTitleUpdated(runtime: TabRuntime): void {
    if (!this.isCurrentRuntime(runtime)) return;
    const pageInfo = this.pageInfo(runtime);
    this.sniffingHelper.update(runtime.tabId, pageInfo);
    if (runtime.kind === "user") this.updateTabPage(runtime.tabId, pageInfo);
  }

  private onFaviconUpdated(runtime: TabRuntime, favicons: string[]): void {
    if (runtime.kind !== "user" || !this.isCurrentRuntime(runtime)) return;
    const tab = this.requireTab(runtime.tabId);
    tab.favicon = favicons[0];
    this.emitSnapshot();
  }

  private readonly onSource = async ({
    tabId,
    source,
  }: SniffingSourceEvent): Promise<void> => {
    const runtime = this.runtimes.get(tabId);
    if (!runtime || runtime.kind !== "user") return;
    const enriched = await this.withBilibiliSessionCookies(tabId, source);
    if (!this.isCurrentRuntime(runtime)) return;
    const tab = this.requireTab(tabId);
    const existing = tab.sources.find((item) => item.url === enriched.url);
    let nextID = 1;
    for (const item of tab.sources) nextID = Math.max(nextID, item.id + 1);
    const safeSource = {
      id: existing?.id ?? nextID,
      url: enriched.url,
      documentURL: enriched.documentURL,
      name: enriched.name,
      type: enriched.type,
      mediaInfo: enriched.mediaInfo,
    };
    tab.sources = mergeSniffedSource(tab.sources, safeSource);
    this.emitSnapshot();
    this.sendRuntime(runtime, IpcEvent.browser.sourceDetected, {
      tabId,
      source: { ...safeSource, headers: enriched.headers },
    } satisfies BrowserSourceDetectedPayload);
  };

  private updateTabPage(
    tabId: string,
    pageInfo: { title: string; url: string },
    status?: BrowserTabSnapshot["status"],
  ): void {
    const tab = this.requireTab(tabId);
    tab.url = pageInfo.url;
    tab.title = pageInfo.title;
    if (status) tab.status = status;
    this.emitSnapshot();
  }

  private pageInfo(runtime: TabRuntime): { title: string; url: string } {
    return {
      title: runtime.view.webContents.getTitle(),
      url: runtime.view.webContents.getURL(),
    };
  }

  private attachRuntime(runtime?: TabRuntime): void {
    if (
      !runtime ||
      runtime.kind !== "user" ||
      runtime.tabId !== this.activeTabId ||
      !runtime.bounds
    )
      return;
    const targetWindow = this.currentWindow;
    if (!targetWindow || targetWindow.isDestroyed()) return;
    if (runtime.attachedWindow === targetWindow) return;
    this.detachRuntime(runtime);
    targetWindow.contentView.addChildView(runtime.view);
    runtime.attachedWindow = targetWindow;
    runtime.view.setBounds(runtime.bounds);
  }

  private detachRuntime(runtime?: TabRuntime): void {
    if (!runtime?.attachedWindow) return;
    if (!runtime.attachedWindow.isDestroyed()) {
      runtime.attachedWindow.contentView.removeChildView(runtime.view);
    }
    runtime.attachedWindow = null;
  }

  private destroyRuntime(tabId: string): void {
    const runtime = this.runtimes.get(tabId);
    if (!runtime) return;
    this.runtimes.delete(tabId);
    this.detachRuntime(runtime);
    this.sniffingHelper.unregister(tabId);
    runtime.view.webContents.close();
  }

  private isCurrentRuntime(runtime: TabRuntime): boolean {
    return this.runtimes.get(runtime.tabId) === runtime;
  }

  private sendRuntime(
    runtime: TabRuntime,
    channel: string,
    payload: unknown,
  ): void {
    const target = runtime.attachedWindow ?? this.currentWindow;
    if (!target || target.isDestroyed()) return;
    target.webContents.send(channel, payload);
  }

  private sendToCurrentWindow(channel: string, payload?: unknown): void {
    const target = this.currentWindow;
    if (!target || target.isDestroyed()) return;
    target.webContents.send(channel, payload);
  }

  private emitSnapshot(): void {
    this.sendToCurrentWindow(IpcEvent.browser.tabsChanged, this.getSnapshot());
  }

  private get currentWindow(): Electron.BrowserWindow | null {
    if (this.browserWindow.window) return this.browserWindow.window;
    return this.mainWindow.window;
  }

  private runtimePartitions(includeDefault = false): Set<string> {
    const partitions = new Set<string>();
    if (includeDefault) partitions.add(this.defaultPartition);
    for (const runtime of this.runtimes.values())
      partitions.add(runtime.partition);
    return partitions;
  }

  private applyProxyToPartition(partition: string): void {
    const { useProxy, proxy } = this.configCache.store;
    const targetSession = session.fromPartition(partition);
    if (useProxy) enableSessionProxy(targetSession, this.logger, proxy);
    else void targetSession.setProxy({ proxyRules: "" });
  }

  private startBlocking(partition: string): void {
    void this.enableBlocking(partition).catch(() => {
      this.logger.error("[AdBlocker] enable failed");
    });
  }

  private async enableBlocking(partition: string): Promise<void> {
    if (Date.now() >= this.blockerExpiresAt) {
      this.blockerExpiresAt = Number.POSITIVE_INFINITY;
      this.blockerLoader.invalidate();
    }
    const blocker = await this.blockerLoader.load();
    if (!blocker || !this.blockingRequested) return;
    if (this.blocker && this.blocker !== blocker) this.disableBlocking();
    this.blocker = blocker;
    const targetSession = session.fromPartition(partition);
    if (this.blockingSessions.has(targetSession)) return;
    if (!blocker.isBlockingEnabled(targetSession)) {
      blocker.enableBlockingInSession(targetSession);
    }
    this.blockingSessions.add(targetSession);
  }

  private disableBlocking(): void {
    if (!this.blocker) return;
    for (const targetSession of this.blockingSessions) {
      if (this.blocker.isBlockingEnabled(targetSession)) {
        this.blocker.disableBlockingInSession(targetSession);
      }
    }
    this.blockingSessions.clear();
  }

  private observeBlockerRefresh(
    refresh: Promise<AdBlockerCacheValue | undefined>,
  ): void {
    void refresh
      .then((result) => {
        if (!result) {
          this.blockerExpiresAt = 0;
          this.blockerLoader.invalidate();
          return;
        }
        this.disableBlocking();
        this.blocker = result.blocker;
        this.blockerExpiresAt = result.expiresAt;
        this.blockerLoader.replace(result.blocker);
        if (this.blockingRequested) {
          for (const partition of this.runtimePartitions(true)) {
            this.startBlocking(partition);
          }
        }
      })
      .catch(() => {
        this.blockerExpiresAt = 0;
        this.blockerLoader.invalidate();
        this.logger.error("[AdBlocker] list load failed");
      });
  }
}

function hasCookieHeader(headers?: string): boolean {
  if (!headers) return false;
  return headers
    .replace(/\r\n/g, "\n")
    .split("\n")
    .some((line) => line.split(":", 1)[0]?.trim().toLowerCase() === "cookie");
}
