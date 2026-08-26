import { DownloadType, IpcEvent } from "@mediago/shared-common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentCollectionError } from "./sniffing-helper.service";

const moduleMocks = vi.hoisted(() => ({
  resolve: vi.fn(() => "/tmp/preload.cjs"),
}));

const electronMocks = vi.hoisted(() => ({
  failNextAllocation: false,
  nextWebContentsId: 1,
  sessions: new Map<string, ReturnType<typeof createMockSession>>(),
  views: [] as Array<{
    setBounds: ReturnType<typeof vi.fn>;
    webContents: Record<string, any>;
  }>,
}));

const adBlockerCacheMocks = vi.hoisted(() => ({
  load: vi.fn(async () => ({
    blocker: undefined,
    expiresAt: Number.POSITIVE_INFINITY,
  })),
}));

vi.mock("node:module", () => ({
  createRequire: () =>
    Object.assign(vi.fn(), {
      resolve: moduleMocks.resolve,
    }),
}));

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/user-data") },
  session: {
    fromPartition: vi.fn((partition: string) => {
      let target = electronMocks.sessions.get(partition);
      if (!target) {
        target = createMockSession();
        electronMocks.sessions.set(partition, target);
      }
      return target;
    }),
  },
  WebContentsView: class MockWebContentsView {
    setBackgroundColor = vi.fn();
    setBounds = vi.fn();
    webContents: Record<string, any>;

    constructor() {
      if (electronMocks.failNextAllocation) {
        electronMocks.failNextAllocation = false;
        throw new Error("allocation failed");
      }
      const handlers = new Map<string, Array<(...args: any[]) => void>>();
      let title = "Page";
      let url = "";
      let windowOpenHandler:
        | ((details: { url: string }) => unknown)
        | undefined;
      const webContents = {
        id: electronMocks.nextWebContentsId++,
        capturePage: vi.fn(async () => null),
        close: vi.fn(),
        emit: (event: string, ...args: any[]) => {
          for (const handler of handlers.get(event) ?? []) handler(...args);
        },
        executeJavaScript: vi.fn(async () => undefined),
        getTitle: vi.fn(() => title),
        getURL: vi.fn(() => url),
        loadURL: vi.fn(async (nextURL: string) => {
          url = nextURL;
        }),
        navigationHistory: {
          canGoBack: vi.fn(() => false),
          goBack: vi.fn(),
        },
        on: vi.fn((event: string, handler: (...args: any[]) => void) => {
          handlers.set(event, [...(handlers.get(event) ?? []), handler]);
        }),
        openDevTools: vi.fn(),
        reload: vi.fn(),
        setAudioMuted: vi.fn(),
        setTitle: (nextTitle: string) => {
          title = nextTitle;
        },
        setUserAgent: vi.fn(),
        setWindowOpenHandler: vi.fn(
          (handler: (details: { url: string }) => unknown) => {
            windowOpenHandler = handler;
          },
        ),
        stop: vi.fn(),
        triggerWindowOpen: (nextURL: string) =>
          windowOpenHandler?.({ url: nextURL }),
      };
      this.webContents = webContents;
      electronMocks.views.push(this);
    }
  },
}));

vi.mock("@ghostery/adblocker-electron", () => ({
  ElectronBlocker: {},
}));

vi.mock("./ad-blocker-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ad-blocker-cache")>();
  return {
    ...actual,
    createAdBlockerCache: () => ({ load: adBlockerCacheMocks.load }),
  };
});

vi.mock("../utils", () => ({
  isDeeplink: vi.fn(() => false),
  mobileUA: "mobile-user-agent",
  pcUA: "desktop-user-agent",
  PERSIST_WEBVIEW: "persist:webview",
  PRIVACY_WEBVIEW: "privacy-webview",
  pluginUrl: "/missing/plugin.js",
}));

vi.mock("../windows/browser.window", () => ({
  default: class BrowserWindow {},
}));

vi.mock("../windows/main.window", () => ({
  default: class MainWindow {},
}));

vi.mock("../vendor/ElectronLogger", () => ({
  default: class ElectronLogger {},
}));

vi.mock("./go-config-cache", () => ({
  default: class GoConfigCache {},
}));

vi.mock("electron-is-dev", () => ({ default: false }));

const { default: BrowserTabManagerService } =
  await import("./browser-tab-manager.service");

beforeEach(() => {
  vi.clearAllMocks();
  electronMocks.failNextAllocation = false;
  electronMocks.nextWebContentsId = 1;
  electronMocks.sessions.clear();
  electronMocks.views.length = 0;
});

describe("BrowserTabManagerService", () => {
  it("creates tabs lazily and has no fixed tab-count limit", () => {
    const { service } = createHarness();

    for (let index = 0; index < 30; index += 1) service.createTab();

    expect(service.getSnapshot().tabs).toHaveLength(31);
    expect(electronMocks.views).toHaveLength(0);
  });

  it("keeps one view per loaded tab and only attaches the active one", async () => {
    const { mainNativeWindow, service } = createHarness();
    const first = service.getSnapshot().activeTabId;
    await service.loadURL(first, "https://example.com/first");
    service.setBounds(first, { x: 0, y: 40, width: 900, height: 600 });
    const firstView = electronMocks.views[0];

    const second = service.createTab();
    await service.loadURL(second.id, "https://example.com/second");
    service.setBounds(second.id, { x: 0, y: 40, width: 900, height: 600 });
    const secondView = electronMocks.views[1];

    expect(mainNativeWindow.contentView.removeChildView).toHaveBeenCalledWith(
      firstView,
    );
    expect(mainNativeWindow.contentView.addChildView).toHaveBeenLastCalledWith(
      secondView,
    );

    service.activateTab(first);
    expect(
      mainNativeWindow.contentView.removeChildView,
    ).toHaveBeenLastCalledWith(secondView);
    expect(mainNativeWindow.contentView.addChildView).toHaveBeenLastCalledWith(
      firstView,
    );
    expect(electronMocks.views).toHaveLength(2);
  });

  it("preserves tab state when allocating a view fails", async () => {
    const { service } = createHarness();
    const tabId = service.getSnapshot().activeTabId;
    electronMocks.failNextAllocation = true;

    await expect(
      service.loadURL(tabId, "https://example.com/failure"),
    ).rejects.toThrow("Unable to allocate a browser tab");

    const tab = service.getSnapshot().tabs[0];
    expect(tab.id).toBe(tabId);
    expect(tab.status).toBe("failed");
    expect(tab.url).toBe("https://example.com/failure");
  });

  it("selects the right neighbor, then the left, and always keeps a home tab", () => {
    const { service } = createHarness();
    const first = service.getSnapshot().activeTabId;
    const second = service.createTab().id;
    const third = service.createTab().id;

    service.activateTab(second);
    expect(service.closeTab(second).activeTabId).toBe(third);
    expect(service.closeTab(third).activeTabId).toBe(first);
    const replacement = service.closeTab(first);

    expect(replacement.tabs).toHaveLength(1);
    expect(replacement.tabs[0].mode).toBe("home");
    expect(replacement.tabs[0].id).not.toBe(first);
  });

  it("opens page popups in a new managed tab", async () => {
    const { service } = createHarness();
    const first = service.getSnapshot().activeTabId;
    await service.loadURL(first, "https://example.com");

    const result = electronMocks.views[0].webContents.triggerWindowOpen(
      "https://example.com/popup",
    );
    await vi.waitFor(() => expect(electronMocks.views).toHaveLength(2));

    expect(result).toEqual({ action: "deny" });
    expect(service.getSnapshot().tabs).toHaveLength(2);
    expect(service.getSnapshot().tabs[1].url).toBe("https://example.com/popup");
  });

  it("reparents the active view when the browser window changes", async () => {
    const { browserWindow, browserNativeWindow, mainNativeWindow, service } =
      createHarness();
    const tabId = service.getSnapshot().activeTabId;
    await service.loadURL(tabId, "https://example.com");
    service.setBounds(tabId, { x: 0, y: 0, width: 800, height: 500 });
    const view = electronMocks.views[0];

    browserWindow.window = browserNativeWindow;
    service.reparentActiveView();

    expect(mainNativeWindow.contentView.removeChildView).toHaveBeenCalledWith(
      view,
    );
    expect(browserNativeWindow.contentView.addChildView).toHaveBeenCalledWith(
      view,
    );
  });

  it("scopes navigation and source events to a tab without persisting headers", async () => {
    const { mainNativeWindow, service, sniffingHelper } = createHarness();
    const tabId = service.getSnapshot().activeTabId;
    await service.loadURL(tabId, "https://example.com/video");
    service.setBounds(tabId, { x: 0, y: 0, width: 800, height: 500 });
    const view = electronMocks.views[0];

    view.webContents.emit("dom-ready");
    const onSource = sniffingHelper.on.mock.calls.find(
      ([event]) => event === "source",
    )?.[1];
    await onSource({
      tabId,
      source: {
        documentURL: "https://example.com/video",
        headers: "Cookie: private",
        name: "video.mp4",
        type: DownloadType.direct,
        url: "https://cdn.example.com/video.mp4",
      },
    });

    expect(mainNativeWindow.webContents.send).toHaveBeenCalledWith(
      IpcEvent.browser.domReady,
      expect.objectContaining({ tabId }),
    );
    expect(mainNativeWindow.webContents.send).toHaveBeenCalledWith(
      IpcEvent.browser.sourceDetected,
      expect.objectContaining({
        tabId,
        source: expect.objectContaining({ headers: "Cookie: private" }),
      }),
    );
    expect(JSON.stringify(service.getSnapshot())).not.toContain("Cookie");

    service.restoreSnapshot({
      ...service.getSnapshot(),
      tabs: [
        {
          ...service.getSnapshot().tabs[0],
          sources: [
            {
              documentURL: "https://example.com/video",
              headers: "Authorization: private",
              id: 1,
              name: "video.mp4",
              type: DownloadType.direct,
              url: "https://cdn.example.com/video.mp4",
            },
          ],
        },
      ],
    } as never);
    expect(JSON.stringify(service.getSnapshot())).not.toContain(
      "Authorization",
    );
  });

  it("keeps Agent discovery views hidden and destroys them after collection", async () => {
    const collection = deferred<{ sources: []; partial: boolean }>();
    const { mainNativeWindow, service, sniffingHelper } = createHarness();
    sniffingHelper.collectAgent.mockReturnValue(collection.promise);
    const controller = new AbortController();
    const result = service.discover(
      discoveryRequest("job-hidden"),
      controller.signal,
    );

    await vi.waitFor(() => expect(sniffingHelper.register).toHaveBeenCalled());
    const registration = sniffingHelper.register.mock.calls[0][0];
    expect(registration.kind).toBe("agent");
    expect(registration.partition).toBe("agent-job-hidden");
    expect(mainNativeWindow.contentView.addChildView).not.toHaveBeenCalled();

    collection.resolve({ sources: [], partial: false });
    await expect(result).resolves.toEqual({ sources: [], partial: false });
    expect(sniffingHelper.unregister).toHaveBeenCalledWith("agent-job-hidden");
    expect(electronMocks.views[0].webContents.close).toHaveBeenCalledOnce();
  });

  it("cancels and cleans up a running Agent discovery", async () => {
    const collection = deferred<{ sources: []; partial: boolean }>();
    const { service, sniffingHelper } = createHarness();
    sniffingHelper.collectAgent.mockReturnValue(collection.promise);
    sniffingHelper.cancelAgent.mockImplementation((tabId: string) => {
      collection.reject(
        new AgentCollectionError("discovery_cancelled", `cancelled ${tabId}`),
      );
    });
    const result = service.discover(
      discoveryRequest("job-cancel"),
      new AbortController().signal,
    );
    await vi.waitFor(() => expect(sniffingHelper.register).toHaveBeenCalled());

    await service.cancel("job-cancel");

    await expect(result).rejects.toMatchObject({
      errorCode: "discovery_cancelled",
    });
    expect(sniffingHelper.cancelAgent).toHaveBeenCalledWith("agent-job-cancel");
    expect(sniffingHelper.unregister).toHaveBeenCalledWith("agent-job-cancel");
  });

  it("propagates runtime configuration and closes every view on destroy", async () => {
    const { discoveryExecutor, service } = createHarness();
    const first = service.getSnapshot().activeTabId;
    await service.loadURL(first, "https://example.com/first");
    const second = service.createTab().id;
    await service.loadURL(second, "https://example.com/second");

    service.setAudioMuted(true);
    service.setUserAgent(true);
    service.setProxy(true, "http://127.0.0.1:7890");
    service.destroy();

    for (const view of electronMocks.views) {
      expect(view.webContents.setAudioMuted).toHaveBeenLastCalledWith(true);
      expect(view.webContents.setUserAgent).toHaveBeenLastCalledWith(
        "mobile-user-agent",
      );
      expect(view.webContents.close).toHaveBeenCalledOnce();
    }
    expect(discoveryExecutor.setBrowser).toHaveBeenLastCalledWith(null);
  });
});

function createHarness() {
  const mainNativeWindow = createNativeWindow();
  const browserNativeWindow = createNativeWindow();
  const mainWindow = { window: mainNativeWindow };
  const browserWindow: {
    window: ReturnType<typeof createNativeWindow> | null;
  } = {
    window: null,
  };
  const logger = { error: vi.fn(), info: vi.fn() };
  const store = {
    audioMuted: false,
    blockAds: false,
    isMobile: false,
    privacy: false,
    proxy: "",
    useProxy: false,
  };
  const configCache = {
    get: vi.fn((key: keyof typeof store) => store[key]),
    store,
  };
  const sniffingHelper = {
    cancelAgent: vi.fn(),
    checkPageInfo: vi.fn(),
    collectAgent: vi.fn(),
    failAgent: vi.fn(),
    getPageHeaders: vi.fn(),
    markDomReady: vi.fn(),
    off: vi.fn(),
    on: vi.fn(),
    pluginReady: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
    update: vi.fn(),
  };
  const discoveryExecutor = { setBrowser: vi.fn() };
  const service = new BrowserTabManagerService(
    mainWindow as never,
    logger as never,
    browserWindow as never,
    configCache as never,
    sniffingHelper as never,
    discoveryExecutor as never,
  );
  return {
    browserNativeWindow,
    browserWindow,
    discoveryExecutor,
    mainNativeWindow,
    service,
    sniffingHelper,
  };
}

function createNativeWindow() {
  return {
    contentView: {
      addChildView: vi.fn(),
      removeChildView: vi.fn(),
    },
    isDestroyed: vi.fn(() => false),
    webContents: { send: vi.fn() },
  };
}

function createMockSession() {
  return {
    clearCache: vi.fn(async () => undefined),
    clearStorageData: vi.fn(async () => undefined),
    cookies: { get: vi.fn(async () => []) },
    setProxy: vi.fn(async () => undefined),
  };
}

function discoveryRequest(discoveryId: string) {
  return {
    type: "discovery-requested" as const,
    discoveryId,
    input: {
      url: "https://example.com/private",
      mode: "browser" as const,
      timeoutMs: 20_000,
      useSessionCookies: false,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}
