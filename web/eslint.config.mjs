import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const deep = { regex: "^@/features/[^/]+/[^/]+/(?!server$).+", message: "Імпортуйте фічу лише через її index.ts або server.ts." };
const legacy = { regex: "^@/(lib|components)(/|$)", message: "Старі шляхи прибрано: використовуйте @/shared або публічний API фічі." };
const routes = { regex: "^@/app(/|$)", message: "Маршрути не імпортуються." };
const restrict = (...extra) => ["error", { patterns: [deep, legacy, routes, ...extra] }];

const outside = "Інша фіча — лише через @/features/<область>/<фіча>.";
const up = [
  { regex: "^\\.\\./", message: outside },
  { regex: "^\\.\\./\\.\\./", message: outside },
];

const edges = {
  "shop/analytics": [],
  "shop/cart": ["shop/analytics"],
  "shop/catalog": ["shop/cart"],
  "shop/product": ["shop/catalog", "shop/cart", "shop/analytics"],
  "shop/home": ["shop/catalog", "shop/services", "shop/content"],
  "shop/layout": ["shop/cart", "shop/catalog", "shop/services", "shop/content", "shop/search"],
  "shop/search": ["shop/catalog"],
  "shop/checkout": ["shop/cart", "shop/analytics"],
  "shop/order": ["shop/payment", "shop/analytics"],
  "shop/payment": [],
  "shop/services": [],
  "shop/content": [],
  "admin/auth": [],
  "admin/shell": ["admin/auth"],
  "admin/dashboard": ["admin/shell", "admin/orders", "admin/catalog"],
  "admin/orders": ["admin/shell"],
  "admin/customers": [],
  "admin/requests": ["admin/shell"],
  "admin/catalog": ["admin/auth"],
  "admin/content": ["admin/auth"],
  "admin/integration": ["admin/auth"],
  "admin/staff": ["admin/auth"],
  "admin/audit": ["admin/auth"],
};

const dependsOn = (feature) => ({
  regex: edges[feature].length ? `^@/features/(?!(${edges[feature].join("|")})(/server)?$)` : "^@/features(/|$)",
  message: `Фіча ${feature} залежить лише від: ${edges[feature].join(", ") || "shared"}.`,
});
const unlisted = { regex: "^@/features(/|$)", message: "Нова фіча: додайте її залежності в edges у eslint.config.mjs." };

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "@next/next/no-img-element": "off" } },
  { files: ["src/**/*.{ts,tsx}"], rules: { "no-restricted-imports": restrict() } },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrict(
        { regex: "^@/features(/|$)", message: "shared не залежить від фіч." },
        { regex: "^(\\.\\.?/)+(.*/)?features(/|$)", message: "shared не залежить від фіч." },
      ),
    },
  },
  { files: ["src/features/*/*/*.{ts,tsx}"], rules: { "no-restricted-imports": restrict(up[0], unlisted) } },
  { files: ["src/features/*/*/*/*.{ts,tsx}"], rules: { "no-restricted-imports": restrict(up[1], unlisted) } },
  ...Object.keys(edges).flatMap((feature) => [
    { files: [`src/features/${feature}/*.{ts,tsx}`], rules: { "no-restricted-imports": restrict(up[0], dependsOn(feature)) } },
    { files: [`src/features/${feature}/*/*.{ts,tsx}`], rules: { "no-restricted-imports": restrict(up[1], dependsOn(feature)) } },
  ]),
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrict(
        { regex: "^@/shared(/|$)", message: "Маршрут складає екран лише з публічного API фіч." },
        { regex: "^\\.\\.?/(?!.*\\.css$)", message: "Маршрут не імпортує сусідні модулі: перенесіть код у фічу." },
      ),
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
