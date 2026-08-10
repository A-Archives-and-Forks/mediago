import { dev, devBuild } from "./scripts/dev";
import {
  releaseBuild,
  releaseClean,
  releasePackageFull,
} from "./scripts/release";

// ============================================================
// Development Tasks
// ============================================================

export { dev, devBuild };
export const build = devBuild;

// ============================================================
// Release Tasks
// ============================================================

export { releaseBuild, releaseClean, releasePackageFull };
