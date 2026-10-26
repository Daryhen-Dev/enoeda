import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Destructuring to drop a field is a documented pattern (e.g. stripping an
  // altcha field from user input before parsing the rest): the underscore
  // prefix marks it as intentionally unread, so the rule stays meaningful for
  // genuinely dead code.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { destructuredArrayIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
