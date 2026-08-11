import assert from "node:assert/strict";
import test from "node:test";
import { DownloadType } from "@mediago/shared-common";
import {
  captureWebShareIntent,
  consumeStartupShareError,
  drainPendingWebShareIntents,
} from "./share-intent";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function createHistory() {
  const replacements: string[] = [];
  return {
    replacements,
    replaceState(_data: unknown, _unused: string, url?: string | URL | null) {
      replacements.push(String(url));
    },
  };
}

test("captures a fragment share once and preserves nested query parameters", () => {
  const storage = new MemoryStorage();
  const history = createHistory();
  const mediaUrl = "https://media.example/live.m3u8?token=a&expires=2";
  const params = new URLSearchParams({
    url: mediaUrl,
    name: "Episode 1",
  });

  assert.equal(
    captureWebShareIntent(
      { pathname: "/", search: "", hash: `#/share?${params}` },
      history,
      storage,
    ),
    true,
  );
  assert.deepEqual(history.replacements, ["/"]);

  const [intent] = drainPendingWebShareIntents(storage);
  assert.equal(intent.url, mediaUrl);
  assert.equal(intent.name, "Episode 1");
  assert.equal(intent.type, DownloadType.m3u8);
  assert.deepEqual(drainPendingWebShareIntents(storage), []);
  assert.equal(
    captureWebShareIntent(
      { pathname: "/", search: "", hash: `#/shared?${params}` },
      history,
      storage,
    ),
    false,
  );
});

test("maps PWA title/text fields and rejects unsafe shared URLs", () => {
  const storage = new MemoryStorage();
  const history = createHistory();
  const params = new URLSearchParams({
    title: "Shared video",
    text: "Open https://example.com/video.mp4 to watch",
  });

  captureWebShareIntent(
    { pathname: "/share", search: `?${params}`, hash: "" },
    history,
    storage,
  );
  const [intent] = drainPendingWebShareIntents(storage);
  assert.equal(intent.source, "pwa");
  assert.equal(intent.name, "Shared video");
  assert.equal(intent.url, "https://example.com/video.mp4");

  captureWebShareIntent(
    { pathname: "/share", search: "?url=javascript%3Aalert(1)", hash: "" },
    history,
    storage,
  );
  assert.equal(consumeStartupShareError(), true);
  assert.deepEqual(drainPendingWebShareIntents(storage), []);
});
