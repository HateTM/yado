import js from "@eslint/js";
import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import pluginReact from "eslint-plugin-react";

export default [
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      js,
      "@typescript-eslint": tseslint,
      react: pluginReact,
    },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      pluginReact.configs.flat.recommended,
    ],
    rules: {
      ...tseslint.configs.recommended.rules, // <-- Added comma
      ...pluginReact.configs.flat.recommended.rules,
    },
  },];
