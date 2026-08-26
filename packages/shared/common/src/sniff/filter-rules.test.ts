import { describe, expect, it } from "vitest";
import { DownloadType } from "../types";
import { matchPageUrl, shouldSuppressRequestSource } from "./filter-rules";

describe("matchPageUrl", () => {
  it.each([
    "https://x.com/openai/status/1234567890",
    "https://www.x.com/openai/status/1234567890?ref_src=twsrc",
    "https://twitter.com/openai/status/1234567890",
    "https://mobile.twitter.com/openai/status/1234567890/video/1",
  ])("routes X/Twitter status URLs through yt-dlp: %s", (url) => {
    expect(matchPageUrl(url)?.type).toBe(DownloadType.youtube);
  });

  it.each([
    "https://x.com/",
    "https://x.com/explore",
    "https://twitter.com/search?q=video",
  ])("does not treat a non-status X page as a download: %s", (url) => {
    expect(matchPageUrl(url)).toBeUndefined();
  });
});

describe("shouldSuppressRequestSource", () => {
  it.each([
    "https://x.com/home",
    "https://www.x.com/openai/status/123",
    "https://twitter.com/search?q=video",
    "https://mobile.twitter.com/home",
  ])("prefers the X/Twitter page extractor for generic media on %s", (url) => {
    expect(shouldSuppressRequestSource(url, DownloadType.direct)).toBe(true);
    expect(shouldSuppressRequestSource(url, DownloadType.m3u8)).toBe(true);
  });

  it("keeps specialised page sources and unrelated sites", () => {
    expect(
      shouldSuppressRequestSource(
        "https://x.com/openai/status/123",
        DownloadType.youtube,
      ),
    ).toBe(false);
    expect(
      shouldSuppressRequestSource(
        "https://example.com/video",
        DownloadType.direct,
      ),
    ).toBe(false);
    expect(
      shouldSuppressRequestSource(
        "https://x.com.example/video",
        DownloadType.direct,
      ),
    ).toBe(false);
  });
});
