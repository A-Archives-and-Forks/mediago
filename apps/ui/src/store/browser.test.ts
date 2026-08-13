import assert from "node:assert/strict";
import test from "node:test";
import { DownloadType } from "@mediago/shared-common";
import {
  browserSourcePanelSelector,
  type SourceData,
  useBrowserStore,
} from "./browser";

const source = (overrides: Partial<SourceData>): SourceData => ({
  id: 0,
  url: "https://media.example/video.m3u8",
  documentURL: "https://example.com/watch/video",
  name: "Example video",
  type: DownloadType.m3u8,
  ...overrides,
});

test("browser store updates inspections and collapses master variants", () => {
  const store = useBrowserStore.getState();
  store.clearSources();
  const child = source({ url: "https://media.example/720.m3u8" });
  store.addSource(child);
  store.addSource(
    source({
      url: "https://media.example/master.m3u8",
      mediaInfo: {
        status: "inspecting",
        playlistType: "unknown",
        variants: [],
      },
    }),
  );
  store.addSource(
    source({
      url: "https://media.example/master.m3u8",
      mediaInfo: {
        status: "ready",
        playlistType: "master",
        maxQuality: "1080p",
        variants: [
          { url: child.url, quality: "720p" },
          { url: "https://media.example/1080.m3u8", quality: "1080p" },
        ],
      },
    }),
  );

  const sources = useBrowserStore.getState().sources;
  assert.equal(sources.length, 1);
  assert.equal(sources[0].url, "https://media.example/master.m3u8");
  assert.equal(sources[0].mediaInfo?.maxQuality, "1080p");
  assert.equal(typeof sources[0].id, "number");
  store.clearSources();
});

test("browser source panel stays collapsed while its resource count updates", () => {
  const store = useBrowserStore.getState();
  store.clearSources();
  store.setBrowserStore({ sourcePanelCollapsed: true });
  store.addSource(source({}));

  assert.deepEqual(browserSourcePanelSelector(useBrowserStore.getState()), {
    hasSources: true,
    sourceCount: 1,
    sourcePanelCollapsed: true,
  });

  store.startNavigation("https://example.com/next");
  assert.deepEqual(browserSourcePanelSelector(useBrowserStore.getState()), {
    hasSources: false,
    sourceCount: 0,
    sourcePanelCollapsed: true,
  });

  store.setBrowserStore({ sourcePanelCollapsed: false });
});
