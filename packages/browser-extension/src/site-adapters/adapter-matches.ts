import { matchesBilibiliPageLocation } from "./bilibili-match";
import type { PageAdapterLocation } from "./types";
import { matchesTwitterPageLocation } from "./twitter-match";
import { matchesYoutubePageLocation } from "./youtube-match";
import { matchesShortVideoPageLocation } from "./short-video-match";

export { matchesBilibiliPageLocation } from "./bilibili-match";
export { matchesTwitterPageLocation } from "./twitter-match";
export { matchesShortVideoPageLocation } from "./short-video-match";
export { matchesYoutubePageLocation } from "./youtube-match";

export function matchesPageAdapterLocation(
  location: PageAdapterLocation,
): boolean {
  return (
    matchesBilibiliPageLocation(location) ||
    matchesYoutubePageLocation(location) ||
    matchesTwitterPageLocation(location) ||
    matchesShortVideoPageLocation(location)
  );
}
