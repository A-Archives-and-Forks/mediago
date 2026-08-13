import assert from "node:assert/strict";
import test from "node:test";
import {
  formattedHeadersToArray,
  inspectionToMediaInfo,
} from "./source-inspection";

test("normalizes multiline sniffed headers", () => {
  assert.deepEqual(
    formattedHeadersToArray(
      "Referer: https://example.com/watch/video\r\nUser-Agent: Test\r\n\r\n",
    ),
    ["Referer: https://example.com/watch/video", "User-Agent: Test"],
  );
});

test("maps successful and failed inspections to UI metadata", () => {
  assert.deepEqual(
    inspectionToMediaInfo({
      id: "source-1",
      url: "https://media.example/master.m3u8",
      playlistType: "master",
      maxQuality: "1080p",
      variants: [{ url: "https://media.example/1080.m3u8", quality: "1080p" }],
    }),
    {
      status: "ready",
      playlistType: "master",
      maxQuality: "1080p",
      variants: [{ url: "https://media.example/1080.m3u8", quality: "1080p" }],
    },
  );
  assert.equal(
    inspectionToMediaInfo({
      id: "source-2",
      url: "https://media.example/invalid.m3u8",
      playlistType: "unknown",
      variants: [],
      error: "unavailable",
    }).status,
    "failed",
  );
});
