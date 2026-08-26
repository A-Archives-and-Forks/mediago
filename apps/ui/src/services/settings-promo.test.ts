import { describe, expect, test, vi } from "vitest";
import {
  isSettingsPromoEligible,
  loadSettingsPromoManifest,
  parseSettingsPromoManifest,
  selectSettingsPromoContent,
} from "./settings-promo";

const sourceUrl =
  "https://raw.githubusercontent.com/mediago-dev/mediago/master/remote-config/settings-promo.json";
const validManifest = {
  schemaVersion: 1,
  enabled: true,
  campaignId: "extension-promo",
  cacheSeconds: 900,
  dismissible: true,
  actionUrl: "https://downloader.caorushizi.cn/extension.html",
  imageUrl:
    "https://raw.githubusercontent.com/mediago-dev/mediago/master/remote-config/promo.webp",
  platforms: ["electron", "web"],
  content: {
    en: {
      badge: "Recommended",
      title: "Install the extension",
      description: "Capture media from your browser.",
      button: "Learn more",
    },
    zh: {
      badge: "推荐",
      title: "安装浏览器扩展",
      description: "从浏览器捕获媒体资源。",
      button: "了解详情",
    },
  },
} as const;

describe("settings promotion manifest", () => {
  test("accepts structured HTTPS content and normalizes defaults", () => {
    const manifest = parseSettingsPromoManifest(validManifest, sourceUrl);

    expect(manifest).not.toBeNull();
    expect(manifest?.campaignId).toBe("extension-promo");
    expect(manifest?.content.zh?.title).toBe("安装浏览器扩展");
  });

  test("rejects insecure actions and cross-origin tracking images", () => {
    expect(
      parseSettingsPromoManifest(
        { ...validManifest, actionUrl: "http://example.com" },
        sourceUrl,
      ),
    ).toBeNull();
    expect(
      parseSettingsPromoManifest(
        { ...validManifest, imageUrl: "https://tracker.example/pixel.gif" },
        sourceUrl,
      ),
    ).toBeNull();
  });

  test("filters by enabled state, schedule, version and platform", () => {
    const manifest = parseSettingsPromoManifest(
      {
        ...validManifest,
        minVersion: "1.2.0",
        maxVersion: "2.0.0",
        startsAt: "2026-01-01T00:00:00Z",
        endsAt: "2027-01-01T00:00:00Z",
        platforms: ["electron"],
      },
      sourceUrl,
    );
    if (!manifest) throw new Error("Expected a valid fixture");

    expect(
      isSettingsPromoEligible(manifest, {
        appVersion: "1.5.0",
        now: Date.parse("2026-08-26T00:00:00Z"),
        platform: "electron",
      }),
    ).toBe(true);
    expect(
      isSettingsPromoEligible(manifest, {
        appVersion: "1.1.9",
        now: Date.parse("2026-08-26T00:00:00Z"),
        platform: "electron",
      }),
    ).toBe(false);
    expect(
      isSettingsPromoEligible(manifest, {
        appVersion: "1.5.0",
        now: Date.parse("2026-08-26T00:00:00Z"),
        platform: "web",
      }),
    ).toBe(false);
  });

  test("selects the current language and falls back to English", () => {
    const manifest = parseSettingsPromoManifest(validManifest, sourceUrl);
    if (!manifest) throw new Error("Expected a valid fixture");

    expect(selectSettingsPromoContent(manifest, "zh-CN")?.title).toBe(
      "安装浏览器扩展",
    );
    expect(selectSettingsPromoContent(manifest, "fr-FR")?.title).toBe(
      "Install the extension",
    );
  });

  test("uses a versioned cache and avoids a duplicate request while fresh", async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify(validManifest), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const first = await loadSettingsPromoManifest(sourceUrl, {
      fetcher,
      now: () => 1_000,
      storage,
    });
    const second = await loadSettingsPromoManifest(sourceUrl, {
      fetcher,
      now: () => 2_000,
      storage,
    });

    expect(first?.campaignId).toBe("extension-promo");
    expect(second?.campaignId).toBe("extension-promo");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
