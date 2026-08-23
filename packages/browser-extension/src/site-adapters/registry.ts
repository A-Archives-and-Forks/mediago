import { bilibiliPageAdapter } from "./bilibili";
import type { PageAdapter, PageAdapterLocation } from "./types";

export const PAGE_ADAPTERS: readonly PageAdapter[] = [bilibiliPageAdapter];

export function findPageAdapter(
  location: PageAdapterLocation,
): PageAdapter | null {
  return PAGE_ADAPTERS.find((adapter) => adapter.matches(location)) ?? null;
}
