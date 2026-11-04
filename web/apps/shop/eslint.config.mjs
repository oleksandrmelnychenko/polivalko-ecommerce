import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { featureBoundaries } from "../../eslint.boundaries.mjs";

const edges = {
  analytics: [],
  customer: [],
  favorites: ["customer"],
  cart: ["analytics"],
  catalog: ["cart", "favorites"],
  product: ["catalog", "cart", "analytics", "favorites"],
  home: ["catalog", "services", "content"],
  layout: ["cart", "catalog", "services", "content", "search", "customer"],
  search: ["catalog"],
  checkout: ["cart", "analytics", "customer"],
  order: ["payment", "analytics"],
  payment: [],
  services: [],
  content: [],
  account: ["customer", "favorites", "catalog", "cart", "checkout", "order", "payment"],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "@next/next/no-img-element": "off" } },
  ...featureBoundaries(edges),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
