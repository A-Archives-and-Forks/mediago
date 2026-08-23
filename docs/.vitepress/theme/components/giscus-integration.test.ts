import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const commentsPath = fileURLToPath(new URL("./Comments.vue", import.meta.url));
const packagePath = fileURLToPath(
  new URL("../../../package.json", import.meta.url),
);

describe("Giscus comments integration", () => {
  it("uses Giscus instead of the retired Waline client", () => {
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as {
      dependencies: Record<string, string>;
    };
    const commentsSource = readFileSync(commentsPath, "utf8");

    expect(packageJson.dependencies["@giscus/vue"]).toBeDefined();
    expect(packageJson.dependencies["@waline/client"]).toBeUndefined();
    expect(commentsSource).toContain('from "@giscus/vue"');
    expect(commentsSource).not.toContain("Waline");
    expect(commentsSource).not.toContain("comments.ziying.site");
  });

  it("recreates the thread on route changes and reacts to site appearance", () => {
    const commentsSource = readFileSync(commentsPath, "utf8");

    expect(commentsSource).toContain(':key="route.path"');
    expect(commentsSource).toContain('v-bind="giscusProps"');
    expect(commentsSource).toContain(
      "getGiscusProps(lang.value, isDark.value)",
    );
    expect(commentsSource).not.toContain("getGiscusKey");
  });
});
