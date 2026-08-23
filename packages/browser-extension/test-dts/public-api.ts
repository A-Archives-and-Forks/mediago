import { DownloadType } from "@mediago/shared-common";
import type { PageCandidate } from "@mediago/browser-extension/site-adapters";
import { matchesBilibiliPageLocation } from "@mediago/browser-extension/site-adapter-matches";

export const candidate: PageCandidate = {
  name: "Example",
  url: "https://www.bilibili.com/video/BV1example",
  type: DownloadType.bilibili,
};

export const matchesHomepage = matchesBilibiliPageLocation({
  hostname: "www.bilibili.com",
});
