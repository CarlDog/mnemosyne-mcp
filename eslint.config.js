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
      "scripts/**",
      "tmp/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
];
