import assert from "node:assert/strict";
import test from "node:test";
import {
  type ConfigChange,
  mergeDeferredConfigChanges,
} from "./config-change-order";

test("a later acknowledgement removes an older snapshot conflict", () => {
  const applied: ConfigChange[] = [];
  const deferred = mergeDeferredConfigChanges(
    [{ key: "apiKey", value: "old" }],
    [{ key: "apiKey", value: "new" }],
    (change) => {
      applied.push(change);
      return true;
    },
  );

  assert.deepEqual(applied, [{ key: "apiKey", value: "new" }]);
  assert.deepEqual(deferred, []);
});

test("only the latest unresolved event for a key remains deferred", () => {
  const deferred = mergeDeferredConfigChanges(
    [{ key: "apiKey", value: "snapshot" }],
    [
      { key: "apiKey", value: "first" },
      { key: "theme", value: "dark" },
      { key: "apiKey", value: "latest" },
    ],
    (change) => change.key === "theme",
  );

  assert.deepEqual(deferred, [{ key: "apiKey", value: "latest" }]);
});

test("unrelated later events do not erase snapshot conflicts", () => {
  const deferred = mergeDeferredConfigChanges(
    [{ key: "apiKey", value: "snapshot" }],
    [{ key: "theme", value: "dark" }],
    () => true,
  );

  assert.deepEqual(deferred, [{ key: "apiKey", value: "snapshot" }]);
});
