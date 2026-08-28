// Guards the scripts/ diagnostics that import from ../dist/.
//
// Those imports must be DYNAMIC for this to work. ESM resolves every static
// import before evaluating any module, so a static `../dist/oc-client.js` on a
// clone that has never been built fails during linking -- before any code in
// this file, or the importing script, gets to run. The failure surfaces as a
// bare ERR_MODULE_NOT_FOUND naming a path inside dist/, with no hint that the
// fix is `npm run build`.
//
// Import this module statically (it depends on nothing built), then reach for
// dist/ with `await import(...)`.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import process from "node:process";

const SENTINEL = fileURLToPath(
  new URL("../dist/oc-client.js", import.meta.url),
);

if (!existsSync(SENTINEL)) {
  console.error(
    "This diagnostic imports the compiled server from dist/, which is missing.\n" +
      "Run `npm run build` first.\n" +
      `(looked for ${SENTINEL})`,
  );
  process.exit(1);
}
