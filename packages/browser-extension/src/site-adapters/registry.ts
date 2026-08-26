import { bilibiliPageAdapter } from "./bilibili";
import type { PageAdapter, PageAdapterLocation } from "./types";
import { youtubePageAdapter } from "./youtube";

export const PAGE_ADAPTERS: readonly PageAdapter[] = [
  bilibiliPageAdapter,
  youtubePageAdapter,
];

export function findPageAdapter(
  location: PageAdapterLocation,
): PageAdapter | null {
  return PAGE_ADAPTERS.find((adapter) => adapter.matches(location)) ?? null;
}
