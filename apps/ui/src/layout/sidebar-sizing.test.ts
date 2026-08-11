import assert from "node:assert/strict";
import test from "node:test";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_SNAP_THRESHOLD,
  clampSidebarExpandedWidth,
  resolveSidebarResize,
} from "./sidebar-sizing";

test("sidebar collapses below the midpoint snap threshold", () => {
  assert.deepEqual(resolveSidebarResize(SIDEBAR_SNAP_THRESHOLD - 1), {
    collapsed: true,
    width: SIDEBAR_COLLAPSED_WIDTH,
  });
});

test("sidebar snaps open at the midpoint threshold", () => {
  assert.deepEqual(resolveSidebarResize(SIDEBAR_SNAP_THRESHOLD), {
    collapsed: false,
    width: SIDEBAR_MIN_WIDTH,
  });
});

test("sidebar holds its minimum width inside the snap gap", () => {
  assert.deepEqual(resolveSidebarResize(SIDEBAR_MIN_WIDTH - 1), {
    collapsed: false,
    width: SIDEBAR_MIN_WIDTH,
  });
});

test("sidebar clamps widths above its maximum", () => {
  assert.deepEqual(resolveSidebarResize(SIDEBAR_MAX_WIDTH + 100), {
    collapsed: false,
    width: SIDEBAR_MAX_WIDTH,
  });
});

test("invalid persisted widths fall back to the default", () => {
  assert.equal(clampSidebarExpandedWidth(Number.NaN), SIDEBAR_DEFAULT_WIDTH);
});
