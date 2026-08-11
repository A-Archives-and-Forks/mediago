import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDownloadPercent } from "./download-progress";

test("keeps Go Core's 0-100 percent scale", () => {
  assert.equal(normalizeDownloadPercent("0.5"), 0.5);
  assert.equal(normalizeDownloadPercent("1"), 1);
  assert.equal(normalizeDownloadPercent(99.5), 99.5);
});

test("clamps and rejects invalid percent values", () => {
  assert.equal(normalizeDownloadPercent(150), 100);
  assert.equal(normalizeDownloadPercent(-1), null);
  assert.equal(normalizeDownloadPercent(undefined), null);
});
