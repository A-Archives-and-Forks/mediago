import assert from "node:assert/strict";
import test from "node:test";
import { DownloadType } from "../types";
import {
  ELECTRON_SHARE_PROTOCOLS,
  WEB_SHARE_PROTOCOLS,
  extractFirstHttpUrl,
  inferDownloadType,
  isFreshShareIntent,
  normalizeShareIntent,
} from "./share-intent";

test("infers download types from parsed hostnames and paths", () => {
  assert.equal(
    inferDownloadType("https://www.bilibili.com/video/BV1"),
    DownloadType.bilibili,
  );
  assert.equal(
    inferDownloadType("https://youtu.be/example"),
    DownloadType.youtube,
  );
  assert.equal(
    inferDownloadType("https://media.example/live/index.m3u8?token=abc"),
    DownloadType.m3u8,
  );
  assert.equal(
    inferDownloadType("https://example.com/video.mp4?next=bilibili.com"),
    DownloadType.direct,
  );
});

test("normalizes supported share intents and rejects unsafe web protocols", () => {
  const intent = normalizeShareIntent(
    {
      id: "intent-1",
      source: "web",
      createdAt: 100,
      url: " https://example.com/video.mp4?token=a&b=c ",
      name: " Episode 1 ",
      type: "M3U8",
    },
    { allowedProtocols: WEB_SHARE_PROTOCOLS, now: 100 },
  );

  assert.deepEqual(intent, {
    id: "intent-1",
    version: 1,
    source: "web",
    createdAt: 100,
    url: "https://example.com/video.mp4?token=a&b=c",
    name: "Episode 1",
    type: DownloadType.m3u8,
    warning: undefined,
  });
  assert.equal(
    normalizeShareIntent(
      { source: "web", url: "file:///C:/private/video.mp4" },
      { allowedProtocols: WEB_SHARE_PROTOCOLS },
    ),
    null,
  );
  assert.notEqual(
    normalizeShareIntent(
      { source: "electron", url: "file:///C:/video.mp4" },
      { allowedProtocols: ELECTRON_SHARE_PROTOCOLS },
    ),
    null,
  );
});

test("extracts shared URLs and expires stale intents", () => {
  assert.equal(
    extractFirstHttpUrl("Watch this: https://example.com/video.m3u8)."),
    "https://example.com/video.m3u8",
  );

  const intent = normalizeShareIntent(
    {
      id: "intent-2",
      source: "web",
      createdAt: 1_000,
      url: "https://example.com/video.mp4",
    },
    { now: 1_000 },
  );
  assert.ok(intent);
  assert.equal(isFreshShareIntent(intent, 1_001), true);
  assert.equal(isFreshShareIntent(intent, 1_000 + 16 * 60 * 1_000), false);
});
