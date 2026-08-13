import type { HLSMediaInfo } from "../types";

export interface GroupableSniffedSource {
  url: string;
  mediaInfo?: HLSMediaInfo;
}

function isMaster(source: GroupableSniffedSource): boolean {
  return source.mediaInfo?.playlistType === "master";
}

function masterContains(
  master: GroupableSniffedSource,
  sourceUrl: string,
): boolean {
  return (
    isMaster(master) &&
    master.mediaInfo?.variants.some((variant) => variant.url === sourceUrl) ===
      true
  );
}

/**
 * Adds or updates one sniffed source while collapsing variants that are
 * explicitly referenced by a detected HLS master playlist. Sources from the
 * same page are never grouped solely by page URL.
 */
export function mergeSniffedSource<T extends GroupableSniffedSource>(
  current: T[],
  incoming: T,
): T[] {
  const withoutSameUrl = current.filter((item) => item.url !== incoming.url);

  if (
    !isMaster(incoming) &&
    withoutSameUrl.some((item) => masterContains(item, incoming.url))
  ) {
    return withoutSameUrl;
  }

  if (!isMaster(incoming)) {
    return [...withoutSameUrl, incoming];
  }

  const relatedUrls = new Set(
    incoming.mediaInfo?.variants.map((variant) => variant.url) ?? [],
  );
  return [
    ...withoutSameUrl.filter((item) => !relatedUrls.has(item.url)),
    incoming,
  ];
}
