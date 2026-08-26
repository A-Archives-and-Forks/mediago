import { matchesBilibiliPageLocation } from "./bilibili-match";
import type { PageAdapterLocation } from "./types";
import { matchesYoutubePageLocation } from "./youtube-match";

export { matchesBilibiliPageLocation } from "./bilibili-match";
export { matchesYoutubePageLocation } from "./youtube-match";

export function matchesPageAdapterLocation(
  location: PageAdapterLocation,
): boolean {
  return (
    matchesBilibiliPageLocation(location) ||
    matchesYoutubePageLocation(location)
  );
}
