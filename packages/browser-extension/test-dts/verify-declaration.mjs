import { readFile } from "node:fs/promises";

const declarationUrl = new URL("../build/site-adapters.d.ts", import.meta.url);
const declaration = await readFile(declarationUrl, "utf8");
const importsSharedDownloadType =
  /import\s+(?:type\s+)?\{[^}]*\bDownloadType\b[^}]*\}\s+from\s+["']@mediago\/shared-common["']/.test(
    declaration,
  );

if (!importsSharedDownloadType) {
  throw new Error(
    "Expected site-adapters.d.ts to import DownloadType from @mediago/shared-common",
  );
}
