import assert from "node:assert/strict";
import test from "node:test";
import { DownloadType } from "@mediago/shared-common";
import { parseShareIntentProtocolUrl } from "./share-intent-parser";

const SCHEME = "mediago-community";

test("parses canonical share links without losing nested query parameters", () => {
  const mediaUrl = "https://media.example/live.m3u8?token=a&expires=2";
  const query = new URLSearchParams({
    v: "1",
    url: mediaUrl,
    name: "Episode 1",
    type: "M3U8",
    headers: "should-not-be-forwarded",
  });

  const result = parseShareIntentProtocolUrl(
    `${SCHEME}://share?${query}`,
    SCHEME,
  );

  assert.equal(result.handled, true);
  assert.ok(result.intent);
  assert.equal(result.intent.source, "electron");
  assert.equal(result.intent.url, mediaUrl);
  assert.equal(result.intent.name, "Episode 1");
  assert.equal(result.intent.type, DownloadType.m3u8);
  assert.equal("headers" in result.intent, false);
});

test("handles focus-only and unsupported-version links without an intent", () => {
  assert.deepEqual(parseShareIntentProtocolUrl(`${SCHEME}://open`, SCHEME), {
    handled: true,
  });
  assert.deepEqual(
    parseShareIntentProtocolUrl(`${SCHEME}://index.html/`, SCHEME),
    { handled: true },
  );
  assert.deepEqual(
    parseShareIntentProtocolUrl(
      `${SCHEME}://share?v=2&url=https%3A%2F%2Fexample.com%2Fvideo.mp4`,
      SCHEME,
    ),
    { handled: true },
  );
});

test("maps legacy automatic-action flags to a warning instead of executing them", () => {
  const mediaUrl = "https://example.com/video.mp4?token=a&part=1";
  const query = new URLSearchParams({
    n: "1",
    encodedURL: mediaUrl,
    name: "Legacy video",
    silent: "1",
    downloadNow: "1",
  });

  const result = parseShareIntentProtocolUrl(
    `${SCHEME}://index.html/?${query}`,
    SCHEME,
  );

  assert.equal(result.handled, true);
  assert.ok(result.intent);
  assert.equal(result.intent.source, "legacy-electron");
  assert.equal(result.intent.url, mediaUrl);
  assert.equal(result.intent.warning, "legacy-auto-action-disabled");
});

test("rejects unrelated targets and unsafe payloads", () => {
  assert.deepEqual(
    parseShareIntentProtocolUrl(
      "other://share?url=https://example.com",
      SCHEME,
    ),
    { handled: false },
  );
  assert.deepEqual(parseShareIntentProtocolUrl(`${SCHEME}://unknown`, SCHEME), {
    handled: false,
  });
  assert.deepEqual(
    parseShareIntentProtocolUrl(
      `${SCHEME}://share?v=1&url=javascript%3Aalert(1)`,
      SCHEME,
    ),
    { handled: true, intent: undefined },
  );
});
