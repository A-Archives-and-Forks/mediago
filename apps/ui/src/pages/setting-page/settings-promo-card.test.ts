import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  manifest: {
    schemaVersion: 1 as const,
    enabled: true,
    campaignId: "test-campaign",
    cacheSeconds: 900,
    dismissible: true,
    actionUrl: "https://example.com/promotion",
    platforms: ["electron" as const],
    content: {
      en: {
        badge: "Recommended",
        title: "<strong>Safe promotion</strong>",
        description: "A remotely configured message.",
        button: "Learn more",
      },
    },
  },
  open: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en" },
  }),
}));

vi.mock("swr", () => ({
  default: () => ({ data: mocks.manifest }),
}));

vi.mock("@/hooks/use-platform", () => ({
  usePlatform: () => ({ shell: { open: mocks.open } }),
}));

const { SettingsPromoCard } = await import("./settings-promo-card");

beforeEach(() => {
  mocks.manifest.enabled = true;
});

test("renders remote copy as escaped text with promotion semantics", () => {
  const html = renderToStaticMarkup(createElement(SettingsPromoCard));

  expect(html).toContain("settingsPromotion");
  expect(html).toContain("Recommended");
  expect(html).toContain("&lt;strong&gt;Safe promotion&lt;/strong&gt;");
  expect(html).not.toContain("<strong>Safe promotion</strong>");
  expect(html).toContain('aria-label="dismissPromotion"');
});

test("does not reserve an empty card when the campaign is disabled", () => {
  mocks.manifest.enabled = false;

  expect(renderToStaticMarkup(createElement(SettingsPromoCard))).toBe("");
});
