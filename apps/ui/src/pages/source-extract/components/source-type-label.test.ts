import { describe, expect, it } from "vitest";
import { DownloadType } from "@mediago/shared-common";
import { sourceTypeLabel } from "./source-type-label";

describe("sourceTypeLabel", () => {
  it("labels X/Twitter yt-dlp sources as X", () => {
    expect(
      sourceTypeLabel({
        type: DownloadType.youtube,
        url: "https://x.com/openai/status/123",
      }),
    ).toBe("X");
    expect(
      sourceTypeLabel({
        type: DownloadType.youtube,
        url: "https://twitter.com/openai/status/123",
      }),
    ).toBe("X");
  });

  it("keeps platform and protocol labels readable", () => {
    expect(
      sourceTypeLabel({
        type: DownloadType.youtube,
        url: "https://www.youtube.com/watch?v=video",
      }),
    ).toBe("YouTube");
    expect(
      sourceTypeLabel({
        type: DownloadType.m3u8,
        url: "https://example.com/live.m3u8",
      }),
    ).toBe("HLS");
    expect(
      sourceTypeLabel({
        type: DownloadType.youtube,
        url: "https://example.com/video",
      }),
    ).toBe("yt-dlp");
  });
});
