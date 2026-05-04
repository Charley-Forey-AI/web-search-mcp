import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import promisePlugin from "eslint-plugin-promise";
import securityPlugin from "eslint-plugin-security";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": tseslint,
      promise: promisePlugin,
      security: securityPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "off",
      "promise/no-return-wrap": "error",
      "promise/always-return": "off",
      "security/detect-object-injection": "off",
    },
  },
];
