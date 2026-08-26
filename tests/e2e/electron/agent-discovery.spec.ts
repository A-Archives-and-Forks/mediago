import type { PlatformApi } from "@mediago/shared-common";
import { electronTest as test, expect } from "../support/electron-app.ts";

declare global {
  interface Window {
    electron: PlatformApi;
  }
}

test("runs Agent discovery in a hidden view without navigating the visible tab", async ({
  electronRuntime,
}) => {
  const { application, client, fixtures, page } = electronRuntime;
  const visibleTabId = await page.evaluate(async (url) => {
    const browser = window.electron.browser;
    const snapshot = await browser.getTabs();
    await browser.loadURL(snapshot.activeTabId, url);
    return snapshot.activeTabId;
  }, fixtures.tabA.url);
  await expect(page.getByRole("tab", { name: /Fixture Tab A/ })).toBeVisible();

  const visibleBefore = await page.evaluate(async () => {
    const browser = window.electron.browser;
    const snapshot = await browser.getTabs();
    return snapshot.tabs.find((tab) => tab.id === snapshot.activeTabId);
  });
  expect(visibleBefore).toMatchObject({
    id: visibleTabId,
    url: fixtures.tabA.url,
  });

  const created = await client.createDiscovery({
    url: fixtures.agent.url,
    mode: "browser",
    timeoutMs: 8_000,
    useSessionCookies: false,
  });
  await expect
    .poll(
      async () => (await client.getDiscovery(created.data.id)).data.status,
      {
        timeout: 15_000,
      },
    )
    .toBe("completed");
  const completed = (await client.getDiscovery(created.data.id)).data;
  expect(completed.sources).toHaveLength(1);
  expect(completed.sources[0]).toMatchObject({
    type: "direct",
    pageUrl: fixtures.agent.url,
  });
  expect(completed.sources[0].url).toContain("fixture=agent");
  expect(JSON.stringify(completed)).not.toContain("headers");

  const visibleAfter = await page.evaluate(async () => {
    const browser = window.electron.browser;
    const snapshot = await browser.getTabs();
    return {
      activeTabId: snapshot.activeTabId,
      activeTab: snapshot.tabs.find((tab) => tab.id === snapshot.activeTabId),
    };
  });
  expect(visibleAfter).toMatchObject({
    activeTabId: visibleTabId,
    activeTab: { id: visibleTabId, url: fixtures.tabA.url },
  });
  await expect
    .poll(() =>
      application.evaluate(
        ({ webContents }, agentURL) =>
          webContents
            .getAllWebContents()
            .some((contents) => contents.getURL() === agentURL),
        fixtures.agent.url,
      ),
    )
    .toBe(false);

  const downloads = await client.createDiscoveryDownloads(completed.id, {
    sourceIds: [completed.sources[0].id],
    startDownload: false,
  });
  expect(downloads.data).toHaveLength(1);
  expect(downloads.data[0]).toMatchObject({
    type: "direct",
    url: completed.sources[0].url,
  });
});
