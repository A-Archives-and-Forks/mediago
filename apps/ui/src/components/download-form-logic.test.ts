import assert from "node:assert/strict";
import test from "node:test";
import { DownloadType } from "@mediago/shared-common";
import {
  buildBatchDownloadTasks,
  buildDownloadTasks,
  createDownloadFormValues,
  DOWNLOAD_URL_RE,
  parseBatchDownloadRows,
} from "./download-form-logic";

test("accepts supported download URL schemes", () => {
  assert.equal(DOWNLOAD_URL_RE.test("https://example.com/video.m3u8"), true);
  assert.equal(DOWNLOAD_URL_RE.test("file://C:/video.mp4"), true);
  assert.equal(DOWNLOAD_URL_RE.test("magnet:?xt=urn:btih:abc"), true);
  assert.equal(DOWNLOAD_URL_RE.test("javascript:alert(1)"), false);
});

test("fills form defaults without replacing supplied values", () => {
  assert.deepEqual(createDownloadFormValues({ name: "episode" }), {
    batch: false,
    batchList: "",
    folder: "",
    headers: "",
    name: "episode",
    type: DownloadType.m3u8,
    url: "",
  });
});

test("ignores blank lines and accepts repeated whitespace", () => {
  assert.deepEqual(
    parseBatchDownloadRows(
      "\nhttps://a.example/1.m3u8   episode-1   season-1\n\thttps://a.example/2.m3u8\t episode-2\n",
    ),
    [
      {
        line: 2,
        url: "https://a.example/1.m3u8",
        name: "episode-1",
        folder: "season-1",
        valid: true,
      },
      {
        line: 3,
        url: "https://a.example/2.m3u8",
        name: "episode-2",
        folder: "",
        valid: true,
      },
    ],
  );
});

test("rejects rows with more than three columns", () => {
  const [row] = parseBatchDownloadRows(
    "https://a.example/1.m3u8 one folder unexpected",
  );
  assert.equal(row.valid, false);
});

test("builds tasks without leaking preview-only fields", () => {
  const rows = parseBatchDownloadRows("https://a.example/1.m3u8 one folder");
  assert.deepEqual(
    buildBatchDownloadTasks(rows, DownloadType.m3u8, "Referer: example.com"),
    [
      {
        url: "https://a.example/1.m3u8",
        name: "one",
        folder: "folder",
        headers: "Referer: example.com",
        type: DownloadType.m3u8,
      },
    ],
  );
});

test("builds one task from single-download form values", () => {
  assert.deepEqual(
    buildDownloadTasks({
      name: "episode",
      url: "https://a.example/1.m3u8",
      type: DownloadType.m3u8,
      folder: "season",
    }),
    [
      {
        name: "episode",
        url: "https://a.example/1.m3u8",
        headers: undefined,
        type: DownloadType.m3u8,
        folder: "season",
      },
    ],
  );
});
