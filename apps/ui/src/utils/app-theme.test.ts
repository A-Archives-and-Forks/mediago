import assert from "node:assert/strict";
import test from "node:test";
import { AppTheme } from "@mediago/shared-common";
import { resolveAppTheme } from "./app-theme";

test("resolves explicit and system themes", () => {
  assert.equal(resolveAppTheme(AppTheme.System, true), "dark");
  assert.equal(resolveAppTheme(AppTheme.System, false), "light");
  assert.equal(resolveAppTheme(AppTheme.Dark, false), "dark");
  assert.equal(resolveAppTheme(AppTheme.Light, true), "light");
});
