import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => {
  const listeners = new Map<string, (details: unknown) => void>();
  const sessions = new Map<
    string,
    { webRequest: { onSendHeaders: ReturnType<typeof vi.fn> } }
  >();
  return {
    fromPartition: vi.fn((partition: string) => {
      let value = sessions.get(partition);
      if (!value) {
        value = {
          webRequest: {
            onSendHeaders: vi.fn((listener: (details: unknown) => void) => {
              listeners.set(partition, listener);
            }),
          },
        };
        sessions.set(partition, value);
      }
      return value;
    }),
    listeners,
    sessions,
  };
});

vi.mock("electron", () => ({
  session: { fromPartition: electronMocks.fromPartition },
}));

vi.mock("@mediago/common", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mediago/common")>();
  return {
    ...actual,
    matchPageUrl: vi.fn(() => undefined),
    matchRequestUrl: vi.fn((url: string) => {
      if (url.endsWith(".m3u8")) return { type: actual.DownloadType.m3u8 };
      if (url.endsWith(".mp4")) return { type: actual.DownloadType.direct };
      return undefined;
    }),
  };
});

vi.mock("../utils", () => ({
  formatHeaders: (headers: Record<string, string>) =>
    Object.entries(headers)
      .map(([name, value]) => `${name}:${value}`)
      .join("\n"),
}));

vi.mock("../vendor/ElectronLogger", () => ({
  default: class ElectronLogger {},
}));

vi.mock("./downloader.server", () => ({
  DownloaderServer: class DownloaderServer {},
}));

const { DownloadType } = await import("@mediago/common");
const { AgentCollectionError, getCookieBackedType, SniffingHelper } =
  await import("./sniffing-helper.service");

afterEach(() => {
  vi.useRealTimers();
});

function createHelper() {
  const inspectSources = vi.fn(async ({ sources }) => ({
    data: {
      sources: sources.map((source: { id: string; url: string }) => ({
        ...source,
        playlistType: "media" as const,
        variants: [],
      })),
    },
  }));
  const logger = { info: vi.fn(), warn: vi.fn() };
  const helper = new SniffingHelper(
    logger as never,
    { getClient: () => ({ inspectSources }) } as never,
  );
  return { helper, inspectSources, logger };
}

function register(
  helper: InstanceType<typeof SniffingHelper>,
  tabId: string,
  webContentsId: number,
  kind: "user" | "agent" = "user",
  useSessionCookies = false,
) {
  helper.register({
    initialPageInfo: {
      title: `Title ${tabId}`,
      url: `https://example.com/${tabId}`,
    },
    kind,
    partition: "persist:webview",
    tabId,
    useSessionCookies,
    webContentsId,
  });
}

describe("SniffingHelper tab isolation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    electronMocks.listeners.clear();
    electronMocks.sessions.clear();
    electronMocks.fromPartition.mockClear();
  });

  it("uses one session listener and routes metadata, dedup, and HLS results by webContentsId", async () => {
    const { helper, inspectSources } = createHelper();
    const events: Array<{
      tabId: string;
      source: {
        url: string;
        documentURL: string;
        name: string;
        mediaInfo?: { status: string };
      };
    }> = [];
    helper.on("source", (event) => events.push(event));
    register(helper, "tab-a", 101);
    register(helper, "tab-b", 202);

    expect(electronMocks.fromPartition).toHaveBeenCalledOnce();
    expect(
      electronMocks.sessions.get("persist:webview")?.webRequest.onSendHeaders,
    ).toHaveBeenCalledOnce();
    const listener = electronMocks.listeners.get("persist:webview");
    expect(listener).toBeTypeOf("function");
    listener?.({
      requestHeaders: { Referer: "https://example.com/tab-a" },
      url: "https://cdn.example.com/a.m3u8",
      webContentsId: 101,
    });
    listener?.({
      requestHeaders: { Referer: "https://example.com/tab-b" },
      url: "https://cdn.example.com/b.m3u8",
      webContentsId: 202,
    });
    listener?.({
      requestHeaders: { Referer: "https://example.com/tab-a" },
      url: "https://cdn.example.com/a.m3u8",
      webContentsId: 101,
    });

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.tabId)).toEqual(["tab-a", "tab-b"]);
    expect(events[0].source).toMatchObject({
      documentURL: "https://example.com/tab-a",
      name: "Title tab-a",
      url: "https://cdn.example.com/a.m3u8",
    });

    await vi.advanceTimersByTimeAsync(150);
    expect(inspectSources).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(4);
    expect(
      events
        .slice(2)
        .map((event) => event.tabId)
        .sort(),
    ).toEqual(["tab-a", "tab-b"]);
    expect(
      events.every((event) =>
        event.source.url.includes(
          event.tabId === "tab-a" ? "a.m3u8" : "b.m3u8",
        ),
      ),
    ).toBe(true);
  });

  it("rejects late HLS inspection results after navigation", async () => {
    let resolveInspection!: (value: unknown) => void;
    const inspection = new Promise((resolve) => {
      resolveInspection = resolve;
    });
    const { helper, inspectSources } = createHelper();
    inspectSources.mockReturnValue(inspection);
    const events: unknown[] = [];
    helper.on("source", (event) => events.push(event));
    register(helper, "tab-a", 101);

    helper.send("tab-a", {
      documentURL: "https://example.com/tab-a",
      name: "Old page",
      type: DownloadType.m3u8,
      url: "https://cdn.example.com/old.m3u8",
    });
    await vi.advanceTimersByTimeAsync(150);
    expect(events).toHaveLength(1);
    helper.update("tab-a", {
      title: "New page",
      url: "https://example.com/new",
    });
    resolveInspection({
      data: {
        sources: [
          {
            id: "hls-101-1",
            playlistType: "media",
            url: "https://cdn.example.com/old.m3u8",
            variants: [],
          },
        ],
      },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toHaveLength(1);
  });

  it("ignores generic media requests on X pages in favor of tweet candidates", async () => {
    const { helper, inspectSources } = createHelper();
    const events: unknown[] = [];
    helper.on("source", (event) => events.push(event));
    register(helper, "tab-x", 303);
    helper.update("tab-x", { title: "Home / X", url: "https://x.com/home" });

    const listener = electronMocks.listeners.get("persist:webview");
    listener?.({
      requestHeaders: { Referer: "https://x.com/home" },
      url: "https://video.twimg.com/ext_tw_video/example/video.mp4",
      webContentsId: 303,
    });
    listener?.({
      requestHeaders: { Referer: "https://x.com/home" },
      url: "https://video.twimg.com/amplify_video/example/playlist.m3u8",
      webContentsId: 303,
    });

    await vi.advanceTimersByTimeAsync(150);

    expect(events).toHaveLength(0);
    expect(inspectSources).not.toHaveBeenCalled();
  });

  it.each([
    "https://www.tiktok.com/foryou",
    "https://www.douyin.com/recommend",
  ])(
    "ignores raw media requests on supported short-video pages: %s",
    async (url) => {
      const { helper, inspectSources } = createHelper();
      const events: unknown[] = [];
      helper.on("source", (event) => events.push(event));
      register(helper, "tab-short-video", 404);
      helper.update("tab-short-video", { title: "Short video", url });

      const listener = electronMocks.listeners.get("persist:webview");
      listener?.({
        requestHeaders: { Referer: url },
        url: "https://media.example.com/video.mp4",
        webContentsId: 404,
      });
      listener?.({
        requestHeaders: { Referer: url },
        url: "https://media.example.com/master.m3u8",
        webContentsId: 404,
      });

      await vi.advanceTimersByTimeAsync(150);

      expect(events).toHaveLength(0);
      expect(inspectSources).not.toHaveBeenCalled();
    },
  );
});

describe("cookie-backed page types", () => {
  it.each([
    ["https://www.bilibili.com/video/BV1", DownloadType.bilibili],
    ["https://www.youtube.com/watch?v=video", DownloadType.youtube],
    ["https://x.com/openai/status/123", DownloadType.youtube],
    ["https://twitter.com/openai/status/123", DownloadType.youtube],
    [
      "https://www.tiktok.com/@creator/video/7480123456789012345",
      DownloadType.youtube,
    ],
    ["https://www.douyin.com/video/7480123456789012345", DownloadType.youtube],
    [
      "https://www.xiaohongshu.com/explore/66f00abc1234567890abcdef?xsec_token=token",
      DownloadType.xiaohongshu,
    ],
  ])("maps %s to %s", (url, type) => {
    expect(getCookieBackedType(url)).toBe(type);
  });

  it("does not classify an unrelated site", () => {
    expect(getCookieBackedType("https://example.com/video")).toBeUndefined();
  });
});

describe("SniffingHelper Agent collection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    electronMocks.listeners.clear();
    electronMocks.sessions.clear();
  });

  it("waits for DOM ready and network quiet, then returns redacted headers", async () => {
    const { helper } = createHelper();
    register(helper, "agent-job", 303, "agent", false);
    const result = helper.collectAgent("agent-job", { timeoutMs: 20_000 });
    helper.send("agent-job", {
      documentURL: "https://example.com/watch",
      headers:
        "Referer:https://example.com/watch\nCookie:sentinel-cookie\nAuthorization:Bearer sentinel-auth",
      name: "Agent page",
      type: DownloadType.direct,
      url: "https://cdn.example.com/video.mp4",
    });

    await vi.advanceTimersByTimeAsync(5_000);
    let settled = false;
    void result.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    helper.markDomReady("agent-job");
    await vi.advanceTimersByTimeAsync(1_499);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const completed = await result;
    expect(completed.partial).toBe(false);
    expect(completed.sources).toHaveLength(1);
    expect(completed.sources[0].headers).toEqual([
      "Referer: https://example.com/watch",
    ]);
    expect(JSON.stringify(completed)).not.toContain("sentinel");
  });

  it("includes sensitive headers only after explicit session opt-in", async () => {
    const { helper } = createHelper();
    register(helper, "agent-private", 404, "agent", true);
    const result = helper.collectAgent("agent-private", { timeoutMs: 20_000 });
    helper.send("agent-private", {
      documentURL: "https://example.com/watch",
      headers: "Cookie:session=value\nProxy-Authorization:Basic private",
      name: "Private page",
      type: DownloadType.direct,
      url: "https://cdn.example.com/private.mp4",
    });
    helper.markDomReady("agent-private");
    await vi.advanceTimersByTimeAsync(1_500);

    expect((await result).sources[0].headers).toEqual([
      "Cookie: session=value",
      "Proxy-Authorization: Basic private",
    ]);
  });

  it("resets network quiet after each new source", async () => {
    const { helper } = createHelper();
    register(helper, "agent-quiet", 505, "agent");
    const result = helper.collectAgent("agent-quiet", { timeoutMs: 20_000 });
    helper.markDomReady("agent-quiet");
    await vi.advanceTimersByTimeAsync(1_000);
    helper.send("agent-quiet", {
      documentURL: "https://example.com/agent-quiet",
      name: "Quiet",
      type: DownloadType.direct,
      url: "https://cdn.example.com/video.mp4",
    });
    await vi.advanceTimersByTimeAsync(1_499);
    let settled = false;
    void result.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toMatchObject({ partial: false });
  });

  it("enforces hard timeout and cancellation", async () => {
    const { helper } = createHelper();
    register(helper, "agent-timeout", 606, "agent");
    const timedOut = helper.collectAgent("agent-timeout", { timeoutMs: 3_000 });
    const timeoutAssertion = expect(timedOut).rejects.toMatchObject({
      errorCode: "discovery_timeout",
    });
    await vi.advanceTimersByTimeAsync(3_000);
    await timeoutAssertion;

    helper.unregister("agent-timeout");
    register(helper, "agent-cancel", 707, "agent");
    const controller = new AbortController();
    const cancelled = helper.collectAgent("agent-cancel", {
      signal: controller.signal,
      timeoutMs: 20_000,
    });
    const cancelAssertion =
      expect(cancelled).rejects.toBeInstanceOf(AgentCollectionError);
    controller.abort();
    await cancelAssertion;
  });
});
