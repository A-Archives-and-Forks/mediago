import { defineConfig } from "tsdown";

export default defineConfig({
  exports: true,
  platform: "browser",
  outDir: "build",
  deps: {
    alwaysBundle: [/.*/],
    onlyBundle: false,
  },
  minify: true,
  sourcemap: true,
});
