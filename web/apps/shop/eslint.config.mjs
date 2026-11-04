import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { featureBoundaries } from "../../eslint.boundaries.mjs";

const edges = {
  analytics: [],
  cart: ["analytics"],
  catalog: ["cart"],
  product: ["catalog", "cart", "analytics"],
  home: ["catalog", "services", "content"],
  layout: ["cart", "catalog", "services", "content", "search"],
  search: ["catalog"],
  checkout: ["cart", "analytics"],
  order: ["payment", "analytics"],
  payment: [],
  services: [],
  content: [],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "@next/next/no-img-element": "off" } },
  ...featureBoundaries(edges),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
