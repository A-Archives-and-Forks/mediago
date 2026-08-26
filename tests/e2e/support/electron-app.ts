import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  _electron,
  expect,
  test as base,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { MediaGoClient } from "../../../packages/core-sdk/src/index.ts";
import { scrubElectronEnvironment } from "./electron-network.ts";
import { loadMediaFixture, type MediaFixture } from "./media.ts";
import { assertPortFree, waitForPortFree } from "./ports.ts";
import { startTestPage, type StartedTestPage } from "./test-page.ts";
import { startUIProcess, type StartedUIProcess } from "./ui-process.ts";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const ELECTRON_MAIN_PATH = path.join(
  REPOSITORY_ROOT,
  "apps/electron/build/index.js",
);
const ELECTRON_PACKAGE_PATH = path.join(
  REPOSITORY_ROOT,
  "apps/electron/package.json",
);
const ELECTRON_CORE_PORT = 39_719;
const LOCAL_NO_PROXY =
  "localhost,127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16";

export interface ElectronAppRuntime {
  application: ElectronApplication;
  client: MediaGoClient;
  fixtures: {
    agent: StartedTestPage;
    tabA: StartedTestPage;
    tabB: StartedTestPage;
  };
  media: MediaFixture;
  page: Page;
}

interface EnvPathPayload {
  coreUrl: string;
}

function electronExecutablePath(): string {
  const electronRequire = createRequire(ELECTRON_PACKAGE_PATH);
  const executablePath: unknown = electronRequire("electron");
  if (typeof executablePath !== "string" || executablePath.length === 0) {
    throw new Error("Electron package did not resolve to an executable path");
  }
  return executablePath;
}

function electronEnvironment(runtimeRoot: string): Record<string, string> {
  const platformKey = `${process.platform}-${process.arch}`;
  return {
    ...scrubElectronEnvironment(process.env),
    XDG_CONFIG_HOME: path.join(runtimeRoot, "xdg-config"),
    MEDIAGO_CORE_BIN: path.join(REPOSITORY_ROOT, "apps/core/bin/mediago-core"),
    MEDIAGO_DEPS_DIR: path.join(REPOSITORY_ROOT, ".deps", platformKey),
    NO_PROXY: LOCAL_NO_PROXY,
    no_proxy: LOCAL_NO_PROXY,
  };
}

function normalizeEnvPath(value: unknown): EnvPathPayload {
  let payload = value;
  if (typeof value === "object" && value !== null && "code" in value) {
    const envelope = value as { code?: unknown; data?: unknown };
    if (envelope.code !== 0) {
      throw new Error("Electron getEnvPath IPC failed");
    }
    payload = envelope.data;
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("coreUrl" in payload) ||
    typeof payload.coreUrl !== "string"
  ) {
    throw new Error("Electron getEnvPath IPC returned an invalid payload");
  }
  return { coreUrl: payload.coreUrl };
}

async function closeElectron(application?: ElectronApplication): Promise<void> {
  if (!application) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      application.close(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Electron close timed out")),
          5_000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const electronTest = base.extend<{
  electronRuntime: ElectronAppRuntime;
}>({
  electronRuntime: [
    async ({ browserName: _browserName }, use) => {
      if (process.platform !== "linux" || process.arch !== "x64") {
        base.skip(
          true,
          `Electron E2E requires the linux-x64 CI runtime; received ${process.platform}-${process.arch}`,
        );
      }

      const runtimeRoot = await mkdtemp(
        path.join(tmpdir(), "mediago-e2e-browser-"),
      );
      let application: ElectronApplication | undefined;
      let media: MediaFixture | undefined;
      let ui: StartedUIProcess | undefined;
      let tabA: StartedTestPage | undefined;
      let tabB: StartedTestPage | undefined;
      let agent: StartedTestPage | undefined;
      const cleanupErrors: unknown[] = [];
      let primaryError: unknown;

      try {
        await assertPortFree(
          "0.0.0.0",
          ELECTRON_CORE_PORT,
          "MediaGo Electron Core",
        );
        media = await loadMediaFixture();
        tabA = await startTestPage(`${media.sampleURL}?fixture=tab-a`, {
          marker: "tab-a",
          title: "Fixture Tab A",
        });
        tabB = await startTestPage(`${media.sampleURL}?fixture=tab-b`, {
          marker: "tab-b",
          title: "Fixture Tab B",
        });
        agent = await startTestPage(`${media.sampleURL}?fixture=agent`, {
          marker: "agent",
          title: "Fixture Agent",
        });
        ui = await startUIProcess("electron");
        application = await _electron.launch({
          executablePath: electronExecutablePath(),
          args: [ELECTRON_MAIN_PATH],
          env: electronEnvironment(runtimeRoot),
          locale: "en-US",
        });

        await application.firstWindow();
        await expect
          .poll(() =>
            application
              ?.windows()
              .find((candidate) => candidate.url() === "http://localhost:8500/")
              ?.url(),
          )
          .toBe("http://localhost:8500/");
        const page = application
          .windows()
          .find((candidate) => candidate.url() === "http://localhost:8500/");
        if (!page) throw new Error("Electron main window was not available");

        await expect
          .poll(() =>
            page.evaluate(
              () =>
                typeof (
                  window as Window & {
                    electron?: { app?: { getEnvPath?: unknown } };
                  }
                ).electron?.app?.getEnvPath,
            ),
          )
          .toBe("function");
        const envPath = normalizeEnvPath(
          await page.evaluate(() => {
            const api = (
              window as Window & {
                electron?: { app?: { getEnvPath?: () => Promise<unknown> } };
              }
            ).electron?.app?.getEnvPath;
            if (!api) throw new Error("Electron preload API is unavailable");
            return api();
          }),
        );
        const client = new MediaGoClient({
          baseURL: new URL(envPath.coreUrl).origin,
        });
        client.api.defaults.proxy = false;
        await expect
          .poll(async () => {
            try {
              return (await client.health()).data.status;
            } catch {
              return "unavailable";
            }
          })
          .toBe("ok");
        await expect
          .poll(async () => {
            try {
              return (await client.getDiscoveryExecutorStatus()).data.available;
            } catch {
              return false;
            }
          })
          .toBe(true);

        await page.goto("http://localhost:8500/source");
        await expect(
          page.getByRole("tablist", { name: "Browser tabs" }),
        ).toBeVisible();
        await use({
          application,
          client,
          fixtures: { agent, tabA, tabB },
          media,
          page,
        });
      } catch (error) {
        primaryError = error;
      }

      for (const operation of [
        () => closeElectron(application),
        () => waitForPortFree("0.0.0.0", ELECTRON_CORE_PORT, 10_000),
        () => ui?.process.stop(),
        () => agent?.close(),
        () => tabB?.close(),
        () => tabA?.close(),
        () => media?.close(),
        () => rm(runtimeRoot, { recursive: true, force: true }),
      ]) {
        try {
          // oxlint-disable-next-line no-await-in-loop -- Ordered teardown keeps ownership deterministic.
          await operation();
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
      if (primaryError !== undefined && cleanupErrors.length > 0) {
        throw new AggregateError(
          [primaryError, ...cleanupErrors],
          "Electron E2E failed and cleanup was incomplete",
          { cause: primaryError },
        );
      }
      if (primaryError !== undefined) throw primaryError;
      if (cleanupErrors.length > 0) {
        throw new AggregateError(cleanupErrors, "Electron E2E cleanup failed");
      }
    },
    { timeout: 60_000 },
  ],
});

export { expect } from "@playwright/test";
