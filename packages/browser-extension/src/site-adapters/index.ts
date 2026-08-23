export {
  BILIBILI_PROCESSED_ATTRIBUTE,
  BILIBILI_SELECTORS,
  bilibiliPageAdapter,
} from "./bilibili";
export { matchesBilibiliPageLocation } from "./bilibili-match";
export { findPageAdapter, PAGE_ADAPTERS } from "./registry";
export type {
  PageAdapter,
  PageAdapterLocation,
  PageCandidate,
  PageCard,
  PageCardHandler,
  PageTransport,
} from "./types";
export { startPageRuntime } from "../runtime";
export type { PageRuntimeOptions } from "../runtime";
