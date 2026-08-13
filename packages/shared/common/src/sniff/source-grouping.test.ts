import assert from "node:assert/strict";
import test from "node:test";
import type { HLSMediaInfo } from "../types";
import { mergeSniffedSource } from "./source-grouping";

interface TestSource {
  id: string;
  url: string;
  mediaInfo?: HLSMediaInfo;
}

const mediaInfo = (overrides: Partial<HLSMediaInfo>): HLSMediaInfo => ({
  status: "ready",
  playlistType: "media",
  variants: [],
  ...overrides,
});

test("replaces the pending copy of the same source", () => {
  const pending: TestSource = {
    id: "master",
    url: "https://media.example/master.m3u8",
    mediaInfo: mediaInfo({ status: "inspecting", playlistType: "unknown" }),
  };
  const ready: TestSource = {
    ...pending,
    mediaInfo: mediaInfo({ playlistType: "master", maxQuality: "1080p" }),
  };

  assert.deepEqual(mergeSniffedSource([pending], ready), [ready]);
});

test("collapses child playlists when their master arrives later", () => {
  const child: TestSource = {
    id: "child",
    url: "https://media.example/720.m3u8",
    mediaInfo: mediaInfo({}),
  };
  const master: TestSource = {
    id: "master",
    url: "https://media.example/master.m3u8",
    mediaInfo: mediaInfo({
      playlistType: "master",
      maxQuality: "1080p",
      variants: [
        { url: child.url, quality: "720p" },
        { url: "https://media.example/1080.m3u8", quality: "1080p" },
      ],
    }),
  };

  assert.deepEqual(mergeSniffedSource([child], master), [master]);
  assert.deepEqual(mergeSniffedSource([master], child), [master]);
});

test("keeps unrelated playlists separate", () => {
  const first: TestSource = {
    id: "first",
    url: "https://media.example/first.m3u8",
  };
  const second: TestSource = {
    id: "second",
    url: "https://media.example/second.m3u8",
  };

  assert.deepEqual(mergeSniffedSource([first], second), [first, second]);
});
