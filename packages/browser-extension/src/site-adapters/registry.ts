import { bilibiliPageAdapter } from "./bilibili";
import type { PageAdapter, PageAdapterLocation } from "./types";
import { shortVideoPageAdapter } from "./short-video";
import { twitterPageAdapter } from "./twitter";
import { youtubePageAdapter } from "./youtube";
import { xiaohongshuPageAdapter } from "./xiaohongshu";

export const PAGE_ADAPTERS: readonly PageAdapter[] = [
  bilibiliPageAdapter,
  youtubePageAdapter,
  twitterPageAdapter,
  shortVideoPageAdapter,
  xiaohongshuPageAdapter,
];

export function findPageAdapter(
  location: PageAdapterLocation,
): PageAdapter | null {
  return PAGE_ADAPTERS.find((adapter) => adapter.matches(location)) ?? null;
}
