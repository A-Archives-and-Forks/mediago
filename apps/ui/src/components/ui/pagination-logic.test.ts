import assert from "node:assert/strict";
import test from "node:test";
import {
  getPageItems,
  getPaginationState,
  shouldCorrectPage,
} from "./pagination-logic";

test("does not correct the requested page while its data is loading", () => {
  const { safeCurrent } = getPaginationState(2, 20, 0);

  assert.equal(safeCurrent, 1);
  assert.equal(shouldCorrectPage(2, safeCurrent, true), false);
});

test("keeps a valid requested page after its data has loaded", () => {
  const { safeCurrent } = getPaginationState(2, 20, 45);

  assert.equal(safeCurrent, 2);
  assert.equal(shouldCorrectPage(2, safeCurrent, false), false);
});

test("corrects an out-of-range page after its data has loaded", () => {
  const { safeCurrent } = getPaginationState(3, 20, 35);

  assert.equal(safeCurrent, 2);
  assert.equal(shouldCorrectPage(3, safeCurrent, false), true);
});

test("builds stable page items around the current page", () => {
  assert.deepEqual(getPageItems(6, 12), [
    1,
    "ellipsis-start",
    5,
    6,
    7,
    "ellipsis-end",
    12,
  ]);
});
