import { matchesBilibiliPageLocation } from "./bilibili-match";
import type { PageAdapterLocation } from "./types";
import { matchesTwitterPageLocation } from "./twitter-match";
import { matchesYoutubePageLocation } from "./youtube-match";

export { matchesBilibiliPageLocation } from "./bilibili-match";
export { matchesTwitterPageLocation } from "./twitter-match";
export { matchesYoutubePageLocation } from "./youtube-match";

export function matchesPageAdapterLocation(
  location: PageAdapterLocation,
): boolean {
  return (
    matchesBilibiliPageLocation(location) ||
    matchesYoutubePageLocation(location) ||
    matchesTwitterPageLocation(location)
  );
}
