import { DownloadType } from "@mediago/shared-common";

export function sourceTypeLabel(source: {
  type: DownloadType;
  url: string;
}): string {
  if (source.type === DownloadType.m3u8) return "HLS";
  if (source.type !== DownloadType.youtube) return source.type;

  try {
    const hostname = new URL(source.url).hostname.toLowerCase();
    if (
      hostname === "x.com" ||
      hostname.endsWith(".x.com") ||
      hostname === "twitter.com" ||
      hostname.endsWith(".twitter.com")
    ) {
      return "X";
    }
    if (
      hostname === "youtu.be" ||
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com")
    ) {
      return "YouTube";
    }
  } catch {
    // Fall back to the execution engine label for malformed legacy sources.
  }

  return "yt-dlp";
}
