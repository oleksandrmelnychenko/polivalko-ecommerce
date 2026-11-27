import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { featureBoundaries } from "../../eslint.boundaries.mjs";

const edges = {
  analytics: [],
  assistant: [],
  customer: [],
  favorites: ["customer"],
  cart: ["analytics", "customer"],
  compare: ["cart"],
  seo: [],
  journal: ["content", "seo"],
  catalog: ["cart", "favorites", "seo", "compare"],
  product: ["catalog", "cart", "analytics", "favorites", "seo", "compare"],
  home: ["catalog", "services", "content", "journal"],
  layout: ["cart", "catalog", "services", "content", "search", "customer", "assistant", "compare", "favorites", "journal"],
  search: ["catalog"],
  checkout: ["cart", "analytics", "customer"],
  order: ["payment", "analytics"],
  payment: [],
  services: ["seo", "analytics"],
  content: ["seo", "services"],
  account: ["customer", "favorites", "catalog", "cart", "checkout", "order", "payment"],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "@next/next/no-img-element": "off" } },
  ...featureBoundaries(edges),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
