import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { asRecord } from "../contracts/taskfile-test-helpers.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const actionPath = path.join(
  repositoryRoot,
  ".github/actions/setup-ossutil/action.yml",
);
const actionSource = fs.readFileSync(actionPath, "utf8");
const action = asRecord(parse(actionSource), "setup-ossutil action");

describe("setup-ossutil action contract", () => {
  it("pins the supported version and official archive checksum", () => {
    const inputs = asRecord(action.inputs, "setup-ossutil inputs");
    expect(asRecord(inputs.version, "version input").default).toBe("2.3.0");
    expect(actionSource).toContain(
      "https://gosspublic.alicdn.com/ossutil/v2/${OSSUTIL_VERSION}/${archive_name}",
    );
    expect(actionSource).toContain(
      "3ae4d9fc85a7a6e9f5654d1599766f1a3a42a3692870887b5ae9338d582ef65a",
    );
    expect(actionSource).toContain("sha256sum --check --status");
  });

  it("adds the verified binary to PATH without handling credentials", () => {
    expect(actionSource).toContain("${GITHUB_PATH}");
    expect(actionSource).not.toContain("ACCESS_KEY");
    expect(actionSource).not.toContain("ossutil config");
    expect(actionSource).not.toContain("http://");
  });
});
