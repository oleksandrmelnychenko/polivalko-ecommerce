import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { featureBoundaries } from "../../eslint.boundaries.mjs";

const edges = {
  auth: [],
  shell: ["auth"],
  dashboard: ["shell", "orders", "catalog"],
  orders: ["shell"],
  customers: [],
  requests: ["shell"],
  catalog: ["auth"],
  content: ["auth"],
  integration: ["auth"],
  staff: ["auth"],
  audit: ["auth"],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "@next/next/no-img-element": "off" } },
  ...featureBoundaries(edges),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
