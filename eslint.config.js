import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    // `tmp/` is the gitignored scratch dir (dump-validation.mjs inputs and
    // the like). Linting throwaway files failed `npm run lint` for anyone
    // who had scratch content lying around.
    ignores: [
      "dist/**",
      ".serena/**",
      "node_modules/**",
      "tmp/**",
      // vendored git submodule (Atlas Cloud CLI) -- third-party CommonJS
      // code we don't lint. CI never sees it (checkout runs with
      // submodules: false), but a local `npm run lint` does.
      "vendor/**",
      // webui/ is its own npm package (browser/JSX target, its own
      // tsconfig) with its own eslint config -- linting it under the
      // root's Node/NodeNext parser config would produce nonsense JSX
      // parse errors.
      "webui/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // scripts/ are plain Node ESM, not part of the TS program. They were
    // ignored outright, which meant 1,700+ lines of operator tooling -- the
    // billing-guarded Atlas runner among them -- was linted by nothing.
    // Declaring the three globals they actually use is enough; no `globals`
    // dependency needed for a list this short.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly", URL: "readonly" },
    },
  },
  prettierConfig,
];
