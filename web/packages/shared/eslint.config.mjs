import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const message = "@polivalko/shared не залежить від застосунків і не виходить за межі пакета.";
const restrict = (...extra) => [
  "error",
  {
    patterns: [
      { regex: "^@/", message },
      { regex: "^(shop|console|@polivalko/shared)(/|$)", message },
      { regex: "(^|/)apps(/|$)", message },
      ...extra,
    ],
  },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "@next/next/no-html-link-for-pages": "off" } },
  { files: ["**/*.{ts,tsx}"], rules: { "no-restricted-imports": restrict() } },
  { files: ["*.{ts,tsx}"], rules: { "no-restricted-imports": restrict({ regex: "^\\.\\./", message }) } },
  { files: ["*/*.{ts,tsx}"], rules: { "no-restricted-imports": restrict({ regex: "^\\.\\./\\.\\./", message }) } },
  { files: ["*/*/*.{ts,tsx}"], rules: { "no-restricted-imports": restrict({ regex: "^\\.\\./\\.\\./\\.\\./", message }) } },
]);
