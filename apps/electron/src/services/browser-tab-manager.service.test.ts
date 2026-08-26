import { DownloadType, IpcEvent } from "@mediago/shared-common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentCollectionError } from "./sniffing-helper.service";

const moduleMocks = vi.hoisted(() => ({
  resolve: vi.fn(() => "/tmp/preload.cjs"),
}));

const electronMocks = vi.hoisted(() => ({
  failNextAllocation: false,
  nextWebContentsId: 1,
  openExternal: vi.fn(async () => undefined),
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
  shell: { openExternal: electronMocks.openExternal },
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
        | ((details: {
            disposition: string;
            features: string;
            frameName: string;
            referrer: { policy: string; url: string };
            url: string;
          }) => unknown)
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
        getUserAgent: vi.fn(() => "native-desktop-user-agent"),
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
        setURL: (nextURL: string) => {
          url = nextURL;
        },
        setUserAgent: vi.fn(),
        setWindowOpenHandler: vi.fn((handler: typeof windowOpenHandler) => {
          windowOpenHandler = handler;
        }),
        stop: vi.fn(),
        triggerWindowOpen: (nextURL: string, disposition = "foreground-tab") =>
          windowOpenHandler?.({
            disposition,
            features: "",
            frameName: "",
            referrer: { policy: "default", url },
            url: nextURL,
          }),
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

  it("normalizes schemeless navigation to HTTPS", async () => {
    const { service } = createHarness();
    const tabId = service.getSnapshot().activeTabId;

    await service.loadURL(tabId, "x.com/example/status/123");

    expect(electronMocks.views[0].webContents.loadURL).toHaveBeenCalledWith(
      "https://x.com/example/status/123",
    );
    expect(service.getSnapshot().tabs[0].url).toBe(
      "https://x.com/example/status/123",
    );
  });

  it("routes safe external protocols without replacing the current tab", async () => {
    const { service } = createHarness();
    const tabId = service.getSnapshot().activeTabId;
    await service.loadURL(tabId, "https://example.com/current");

    await service.loadURL(tabId, "mailto:hello@example.com");

    expect(electronMocks.openExternal).toHaveBeenCalledWith(
      "mailto:hello@example.com",
    );
    expect(service.getSnapshot().tabs[0].url).toBe(
      "https://example.com/current",
    );
  });

  it("rejects unsafe browser protocols", async () => {
    const { service } = createHarness();
    const tabId = service.getSnapshot().activeTabId;

    await expect(
      service.loadURL(tabId, "file:///tmp/private.txt"),
    ).rejects.toThrow("Unsupported browser URL protocol");

    expect(electronMocks.views).toHaveLength(0);
    expect(service.getSnapshot().tabs[0]).toMatchObject({
      status: "failed",
      url: "file:///tmp/private.txt",
    });
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

    expect(result).toMatchObject({ action: "allow", outlivesOpener: true });
    expect(result?.createWindow()).toBe(electronMocks.views[1].webContents);
    expect(service.getSnapshot().tabs).toHaveLength(2);
    expect(service.getSnapshot().tabs[1].url).toBe("https://example.com/popup");
    expect(electronMocks.views[1].webContents.loadURL).not.toHaveBeenCalled();
  });

  it("keeps background-tab popups in the background", async () => {
    const { service } = createHarness();
    const first = service.getSnapshot().activeTabId;
    await service.loadURL(first, "https://example.com");

    const result = electronMocks.views[0].webContents.triggerWindowOpen(
      "https://example.com/background",
      "background-tab",
    );

    expect(result).toMatchObject({ action: "allow" });
    expect(service.getSnapshot().activeTabId).toBe(first);
    expect(service.getSnapshot().tabs).toHaveLength(2);
  });

  it("opens safe external protocols outside the embedded browser", async () => {
    const { service } = createHarness();
    const tabId = service.getSnapshot().activeTabId;
    await service.loadURL(tabId, "https://example.com");

    const result = electronMocks.views[0].webContents.triggerWindowOpen(
      "mailto:hello@example.com",
    );

    expect(result).toEqual({ action: "deny" });
    expect(electronMocks.openExternal).toHaveBeenCalledWith(
      "mailto:hello@example.com",
    );
    expect(service.getSnapshot().tabs).toHaveLength(1);
  });

  it("blocks non-web top-level navigation and delegates safe protocols", async () => {
    const { service } = createHarness();
    const tabId = service.getSnapshot().activeTabId;
    await service.loadURL(tabId, "https://example.com");
    const view = electronMocks.views[0];
    const mailEvent = {
      preventDefault: vi.fn(),
      url: "mailto:hello@example.com",
    };
    const fileEvent = {
      preventDefault: vi.fn(),
      url: "file:///tmp/private.txt",
    };
    const webEvent = {
      preventDefault: vi.fn(),
      url: "https://example.com/next",
    };

    view.webContents.emit("will-navigate", mailEvent);
    view.webContents.emit("will-navigate", fileEvent);
    view.webContents.emit("will-navigate", webEvent);

    expect(mailEvent.preventDefault).toHaveBeenCalledOnce();
    expect(fileEvent.preventDefault).toHaveBeenCalledOnce();
    expect(webEvent.preventDefault).not.toHaveBeenCalled();
    expect(electronMocks.openExternal).toHaveBeenCalledWith(
      "mailto:hello@example.com",
    );
    expect(electronMocks.openExternal).not.toHaveBeenCalledWith(
      "file:///tmp/private.txt",
    );
  });

  it("opens Google authentication popups in the system browser", async () => {
    const { service } = createHarness();
    const first = service.getSnapshot().activeTabId;
    await service.loadURL(first, "https://x.com/i/flow/login");

    const authURL = "https://accounts.google.com/o/oauth2/v2/auth?client_id=x";
    const result =
      electronMocks.views[0].webContents.triggerWindowOpen(authURL);

    expect(result).toEqual({ action: "deny" });
    expect(electronMocks.openExternal).toHaveBeenCalledWith(authURL);
    expect(service.getSnapshot().tabs).toHaveLength(1);
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

  it("tracks main-frame navigation and clears resources from the previous page", async () => {
    const { service, sniffingHelper } = createHarness();
    const tabId = service.getSnapshot().activeTabId;
    await service.loadURL(tabId, "https://example.com/first");
    const view = electronMocks.views[0];
    view.webContents.emit("did-stop-loading");
    view.webContents.emit("page-favicon-updated", {}, [
      "https://example.com/favicon.ico",
    ]);
    const onSource = sniffingHelper.on.mock.calls.find(
      ([event]) => event === "source",
    )?.[1];
    await onSource({
      tabId,
      source: {
        documentURL: "https://example.com/first",
        name: "first.mp4",
        type: DownloadType.direct,
        url: "https://cdn.example.com/first.mp4",
      },
    });

    view.webContents.emit("did-start-navigation", {
      isMainFrame: true,
      isSameDocument: false,
      url: "https://example.com/second",
    });

    let tab = service.getSnapshot().tabs[0];
    expect(tab).toMatchObject({
      status: "loading",
      url: "https://example.com/second",
      sources: [],
    });
    expect(tab.favicon).toBeUndefined();

    view.webContents.setURL("https://example.com/second");
    view.webContents.setTitle("Second page");
    view.webContents.emit("did-navigate");
    expect(service.getSnapshot().tabs[0].status).toBe("loading");
    view.webContents.emit("did-stop-loading");
    tab = service.getSnapshot().tabs[0];
    expect(tab).toMatchObject({
      status: "loaded",
      title: "Second page",
      url: "https://example.com/second",
    });
  });

  it("ignores subframe and cancelled load failures", async () => {
    const { service } = createHarness();
    const tabId = service.getSnapshot().activeTabId;
    await service.loadURL(tabId, "https://example.com");
    const view = electronMocks.views[0];
    view.webContents.emit("did-stop-loading");

    view.webContents.emit(
      "did-fail-load",
      {},
      -105,
      "NAME_NOT_RESOLVED",
      "https://iframe.example.invalid",
      false,
    );
    view.webContents.emit(
      "did-fail-load",
      {},
      -3,
      "ABORTED",
      "https://example.com",
      true,
    );
    expect(service.getSnapshot().tabs[0].status).toBe("loaded");

    view.webContents.emit(
      "did-fail-load",
      {},
      -105,
      "NAME_NOT_RESOLVED",
      "https://failed.example.invalid",
      true,
    );
    expect(service.getSnapshot().tabs[0]).toMatchObject({
      errorCode: -105,
      status: "failed",
      url: "https://failed.example.invalid",
    });
  });

  it("ignores in-page navigation events from subframes", async () => {
    const { service, sniffingHelper } = createHarness();
    const tabId = service.getSnapshot().activeTabId;
    await service.loadURL(tabId, "https://example.com/main");
    const view = electronMocks.views[0];
    const updatesBefore = sniffingHelper.update.mock.calls.length;

    view.webContents.emit(
      "did-navigate-in-page",
      {},
      "https://iframe.example.com/#next",
      false,
    );

    expect(service.getSnapshot().tabs[0].url).toBe("https://example.com/main");
    expect(sniffingHelper.update).toHaveBeenCalledTimes(updatesBefore);
  });

  it("turns renderer crashes into a recoverable tab failure", async () => {
    const { service } = createHarness();
    const tabId = service.getSnapshot().activeTabId;
    await service.loadURL(tabId, "https://example.com");
    const crashedView = electronMocks.views[0];

    crashedView.webContents.emit(
      "render-process-gone",
      {},
      {
        exitCode: 1,
        reason: "crashed",
      },
    );

    expect(service.getSnapshot().tabs[0]).toMatchObject({
      errorCode: -1000,
      status: "failed",
    });
    expect(crashedView.webContents.close).toHaveBeenCalledOnce();

    await service.loadURL(tabId, "https://example.com/recovered");
    expect(electronMocks.views).toHaveLength(2);
    expect(service.getSnapshot().tabs[0]).toMatchObject({
      status: "loading",
      url: "https://example.com/recovered",
    });
  });

  it("releases unexpectedly destroyed web contents", async () => {
    const { service, sniffingHelper } = createHarness();
    const tabId = service.getSnapshot().activeTabId;
    await service.loadURL(tabId, "https://example.com");

    electronMocks.views[0].webContents.emit("destroyed");

    expect(sniffingHelper.unregister).toHaveBeenCalledWith(tabId);
    expect(service.getSnapshot().tabs[0]).toMatchObject({
      errorCode: -1001,
      status: "failed",
    });
    await service.loadURL(tabId, "https://example.com/recovered");
    expect(electronMocks.views).toHaveLength(2);
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

  it("keeps the native desktop UA and restores it after mobile mode", async () => {
    const { service } = createHarness();
    const tabId = service.getSnapshot().activeTabId;
    await service.loadURL(tabId, "https://x.com");
    const webContents = electronMocks.views[0].webContents;

    expect(webContents.setUserAgent).not.toHaveBeenCalled();

    service.setUserAgent(true);
    service.setUserAgent(false);

    expect(webContents.setUserAgent).toHaveBeenNthCalledWith(
      1,
      "mobile-user-agent",
    );
    expect(webContents.setUserAgent).toHaveBeenNthCalledWith(
      2,
      "native-desktop-user-agent",
    );
  });

  it("uses the operating system proxy when manual proxy is disabled", () => {
    createHarness();

    expect(
      electronMocks.sessions.get("persist:webview")?.setProxy,
    ).toHaveBeenCalledWith({ mode: "system" });
  });

  it("adds current X session cookies to an explicit yt-dlp task", async () => {
    const { service } = createHarness();
    const tabId = service.getSnapshot().activeTabId;
    await service.loadURL(tabId, "https://x.com/openai/status/1234567890");
    const targetSession = electronMocks.sessions.get("persist:webview");
    targetSession?.cookies.get.mockResolvedValue([
      { name: "auth_token", value: "session-token" },
      { name: "ct0", value: "csrf-token" },
    ]);

    const result = await service.withSessionCookies(tabId, {
      headers: "Referer:https://x.com/",
      type: DownloadType.youtube,
      url: "https://x.com/openai/status/1234567890",
    });

    expect(targetSession?.cookies.get).toHaveBeenCalledWith({
      url: "https://x.com",
    });
    expect(result.headers).toContain("Referer:https://x.com/");
    expect(result.headers).toContain(
      "Cookie:auth_token=session-token; ct0=csrf-token",
    );
  });

  it("does not attach browser cookies to an unrelated yt-dlp URL", async () => {
    const { service } = createHarness();
    const tabId = service.getSnapshot().activeTabId;

    const result = await service.withSessionCookies(tabId, {
      type: DownloadType.youtube,
      url: "https://example.com/video/1",
    });

    expect(result.headers).toBeUndefined();
    expect(
      electronMocks.sessions.get("persist:webview")?.cookies.get,
    ).not.toHaveBeenCalled();
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
