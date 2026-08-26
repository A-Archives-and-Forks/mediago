import type { BrowserTabsSnapshot, PlatformApi } from "@mediago/shared-common";
import { electronTest as test, expect } from "../support/electron-app.ts";

declare global {
  interface Window {
    electron: PlatformApi;
  }
}

async function browserSnapshot(
  page: import("@playwright/test").Page,
): Promise<BrowserTabsSnapshot> {
  return page.evaluate(() => window.electron.browser.getTabs());
}

test("preserves isolated sources and native page state across unlimited tabs", async ({
  electronRuntime,
}) => {
  const { application, fixtures, page } = electronRuntime;
  const loadedTabs = await page.evaluate(
    async ({ firstURL, secondURL }) => {
      const browser = window.electron.browser;
      const initial = await browser.getTabs();
      const firstTabId = initial.activeTabId;
      await browser.loadURL(firstTabId, firstURL);
      const second = await browser.createTab();
      await browser.loadURL(second.id, secondURL);
      return { firstTabId, secondTabId: second.id };
    },
    { firstURL: fixtures.tabA.url, secondURL: fixtures.tabB.url },
  );

  const tabA = page.getByRole("tab", { name: /Fixture Tab A/ });
  const tabB = page.getByRole("tab", { name: /Fixture Tab B/ });
  await expect(tabA).toBeVisible();
  await expect(tabB).toBeVisible();
  await expect(tabA).toHaveAttribute("aria-label", /1 resources/);
  await expect(tabB).toHaveAttribute("aria-label", /1 resources/);
  await expect(tabB).toHaveAttribute("aria-selected", "true");

  await page.evaluate(async (tabId) => {
    await window.electron.browser.activateTab(tabId);
  }, loadedTabs.firstTabId);
  await expect(tabA).toHaveAttribute("aria-selected", "true");
  await expect(tabB).toHaveAttribute("aria-selected", "false");

  await expect
    .poll(() =>
      application.evaluate(
        async ({ webContents }, fixtureURLs) => {
          const expectedURLs = new Set(fixtureURLs);
          const fixtureContents = webContents
            .getAllWebContents()
            .filter((contents) => expectedURLs.has(contents.getURL()));
          return Promise.all(
            fixtureContents.map(async (contents) => ({
              url: contents.getURL(),
              state: await contents.executeJavaScript(
                "({ execution: window.fixtureExecutionState, history: history.state })",
                true,
              ),
            })),
          );
        },
        [fixtures.tabA.url, fixtures.tabB.url],
      ),
    )
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          state: {
            execution: expect.objectContaining({ marker: "tab-a" }),
            history: { marker: "tab-a" },
          },
        }),
        expect.objectContaining({
          state: {
            execution: expect.objectContaining({ marker: "tab-b" }),
            history: { marker: "tab-b" },
          },
        }),
      ]),
    );

  const createdTabIds = await page.evaluate(async () => {
    const browser = window.electron.browser;
    const ids: string[] = [];
    for (let index = 0; index < 25; index += 1) {
      // oxlint-disable-next-line no-await-in-loop -- Sequential creation verifies manager ordering.
      ids.push((await browser.createTab()).id);
    }
    return ids;
  });
  await expect(page.getByRole("tab")).toHaveCount(27);
  await expect(page.getByRole("button", { name: "New tab" })).toBeVisible();
  await expect
    .poll(() =>
      page.getByRole("tablist").evaluate((tablist) => {
        const element = tablist as HTMLElement;
        return element.scrollWidth > element.clientWidth;
      }),
    )
    .toBe(true);

  const middleTabId = createdTabIds[12];
  await page.evaluate(async (tabId) => {
    await window.electron.browser.activateTab(tabId);
  }, middleTabId);
  await expect
    .poll(async () => (await browserSnapshot(page)).activeTabId)
    .toBe(middleTabId);

  await page.evaluate(
    async ({ activeTabId, backgroundTabId }) => {
      const browser = window.electron.browser;
      await browser.closeTab(backgroundTabId);
      await browser.closeTab(activeTabId);
    },
    { activeTabId: middleTabId, backgroundTabId: loadedTabs.firstTabId },
  );
  await expect(page.getByRole("tab")).toHaveCount(25);

  await page.evaluate(async () => {
    const browser = window.electron.browser;
    let snapshot = await browser.getTabs();
    while (snapshot.tabs.length > 1) {
      // oxlint-disable-next-line no-await-in-loop -- Closing in order verifies every native view is released.
      snapshot = await browser.closeTab(snapshot.tabs[0].id);
    }
    await browser.closeTab(snapshot.tabs[0].id);
  });
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(page.getByRole("tab")).toHaveAttribute("aria-label", /New tab/);
  const finalSnapshot = await browserSnapshot(page);
  expect(finalSnapshot.tabs).toHaveLength(1);
  expect(finalSnapshot.tabs[0]).toMatchObject({ mode: "home", sources: [] });
});
