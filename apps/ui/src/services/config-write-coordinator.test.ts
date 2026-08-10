import assert from "node:assert/strict";
import test from "node:test";
import {
  createConfigWriteCoordinator,
  shouldApplyPersistedValue,
} from "./config-write-coordinator";

type TestConfig = {
  proxy: string;
  enabled: boolean;
};

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test("coalesces same-tick values into one latest-only batch", async () => {
  const writes: Array<Partial<TestConfig>> = [];
  const writer = createConfigWriteCoordinator<TestConfig>(async (values) => {
    writes.push(values);
  }, 0);

  const persistedValues = await Promise.all([
    writer.enqueue("proxy", "a"),
    writer.enqueue("proxy", "abc"),
    writer.enqueue("enabled", true),
  ]);

  assert.deepEqual(writes, [{ proxy: "abc", enabled: true }]);
  assert.deepEqual(persistedValues, ["abc", "abc", true]);
});

test("serializes batches and recognizes every local pending echo", async () => {
  const writes: Array<Partial<TestConfig>> = [];
  const releases: Array<() => void> = [];
  const writer = createConfigWriteCoordinator<TestConfig>(
    (values) =>
      new Promise<void>((resolve) => {
        writes.push(values);
        releases.push(resolve);
      }),
    0,
  );

  const first = writer.enqueue("enabled", true);
  await nextTask();
  assert.deepEqual(writes, [{ enabled: true }]);

  const second = writer.enqueue("enabled", false);
  assert.equal(writer.matchesPendingValue("enabled", true), true);
  assert.equal(writer.acknowledgeInFlightValue("enabled", false), false);
  assert.equal(writer.acknowledgeInFlightValue("enabled", true), true);
  assert.equal(writer.matchesPendingValue("enabled", false), true);
  assert.equal(writer.matchesPendingValue("proxy", "remote"), false);
  assert.equal(writes.length, 1);

  const flushing = writer.flush();
  releases[0]();
  const firstPersistedValue = await first;
  assert.equal(firstPersistedValue, true);
  await nextTask();
  assert.deepEqual(writes, [{ enabled: true }, { enabled: false }]);

  releases[1]();
  const [secondPersistedValue] = await Promise.all([second, flushing]);
  assert.equal(secondPersistedValue, false);
  assert.deepEqual(writer.getPending("enabled"), { pending: false });
});

test("continues with a newer batch after a failed write", async () => {
  let attempt = 0;
  const writes: Array<Partial<TestConfig>> = [];
  let rejectFirst: ((error: Error) => void) | undefined;
  const writer = createConfigWriteCoordinator<TestConfig>((values) => {
    writes.push(values);
    attempt += 1;
    if (attempt === 1) {
      return new Promise<void>((_resolve, reject) => {
        rejectFirst = reject;
      });
    }
    return Promise.resolve();
  }, 0);

  const first = assert.rejects(writer.enqueue("proxy", "old"), /disk full/);
  await nextTask();
  const second = writer.enqueue("proxy", "latest");
  rejectFirst?.(new Error("disk full"));

  await first;
  const persistedValue = await second;
  assert.equal(persistedValue, "latest");
  assert.deepEqual(writes, [{ proxy: "old" }, { proxy: "latest" }]);
});

test("clears pending before resolving a successful enqueue", async () => {
  let release: (() => void) | undefined;
  const writer = createConfigWriteCoordinator<TestConfig>(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    0,
  );

  const pendingWhenSettled = writer
    .enqueue("enabled", true)
    .then(() => writer.getPending("enabled"));
  await nextTask();
  assert.deepEqual(writer.getPending("enabled"), {
    pending: true,
    value: true,
  });

  release?.();
  assert.deepEqual(await pendingWhenSettled, { pending: false });
});

test("clears pending before rejecting a failed enqueue", async () => {
  let fail: ((error: Error) => void) | undefined;
  const writer = createConfigWriteCoordinator<TestConfig>(
    () =>
      new Promise<void>((_resolve, reject) => {
        fail = reject;
      }),
    0,
  );

  const pendingWhenSettled = writer.enqueue("enabled", true).then(
    () => assert.fail("write unexpectedly succeeded"),
    () => writer.getPending("enabled"),
  );
  await nextTask();
  assert.deepEqual(writer.getPending("enabled"), {
    pending: true,
    value: true,
  });

  fail?.(new Error("disk full"));
  assert.deepEqual(await pendingWhenSettled, { pending: false });
});

test("keeps a newer pending batch when its value matches the failed batch", async () => {
  let attempt = 0;
  let failFirst: ((error: Error) => void) | undefined;
  const writes: Array<Partial<TestConfig>> = [];
  const writer = createConfigWriteCoordinator<TestConfig>((values) => {
    writes.push(values);
    attempt += 1;
    if (attempt === 1) {
      return new Promise<void>((_resolve, reject) => {
        failFirst = reject;
      });
    }
    return Promise.resolve();
  }, 0);

  const pendingAfterFailure = writer.enqueue("enabled", true).then(
    () => assert.fail("write unexpectedly succeeded"),
    () => writer.getPending("enabled"),
  );
  await nextTask();

  const intermediate = writer.enqueue("enabled", false);
  const latest = writer.enqueue("enabled", true);
  failFirst?.(new Error("disk full"));

  assert.deepEqual(await pendingAfterFailure, {
    pending: true,
    value: true,
  });
  const persisted = await Promise.all([intermediate, latest]);
  assert.deepEqual(persisted, [true, true]);
  assert.deepEqual(writes, [{ enabled: true }, { enabled: true }]);
});

test("treats an in-flight SSE acknowledgement as a committed write", async () => {
  let loseResponse: ((error: Error) => void) | undefined;
  const writer = createConfigWriteCoordinator<TestConfig>(
    () =>
      new Promise<void>((_resolve, reject) => {
        loseResponse = reject;
      }),
    0,
  );

  const persisted = writer.enqueue("enabled", true);
  await nextTask();
  writer.recordRemoteValue("enabled", true);
  loseResponse?.(new Error("response interrupted"));

  assert.equal(await persisted, true);
  assert.deepEqual(writer.getPending("enabled"), { pending: false });
});

test("a newer conflicting remote value wins over a delayed local response", () => {
  const writer = createConfigWriteCoordinator<TestConfig>(async () => {}, 0);
  const versionAtWrite = writer.getRemoteValue("proxy").version;

  writer.recordRemoteValue("proxy", "local");
  assert.equal(
    shouldApplyPersistedValue(
      versionAtWrite,
      writer.getRemoteValue("proxy"),
      "local",
    ),
    true,
  );

  writer.recordRemoteValue("proxy", "newer-remote");
  assert.equal(
    shouldApplyPersistedValue(
      versionAtWrite,
      writer.getRemoteValue("proxy"),
      "local",
    ),
    false,
  );
});
