import type { SourceInspection } from "@mediago/core-sdk";
import type { HLSMediaInfo } from "@mediago/shared-common";

export function formattedHeadersToArray(headers?: string): string[] {
  if (!headers) return [];
  return headers
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((header) => header.trim())
    .filter(Boolean);
}

export function inspectionToMediaInfo(
  inspection?: SourceInspection,
): HLSMediaInfo {
  if (!inspection || inspection.error) {
    return {
      status: "failed",
      playlistType: "unknown",
      variants: [],
    };
  }
  return {
    status: "ready",
    playlistType: inspection.playlistType,
    maxQuality: inspection.maxQuality,
    variants: inspection.variants,
  };
}
