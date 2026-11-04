const deep = { regex: "^@/features/[^/]+/(?!server$).+", message: "Імпортуйте фічу лише через її index.ts або server.ts." };
const legacy = { regex: "^@/(lib|components)(/|$)", message: "Старі шляхи прибрано: використовуйте @/shared, @polivalko/shared або публічний API фічі." };
const routes = { regex: "^@/app(/|$)", message: "Маршрути не імпортуються." };
const apps = { regex: "^(shop|console)(/|$)", message: "Застосунки не імпортують один одного: спільний код — лише в @polivalko/shared." };
const restrict = (...extra) => ["error", { patterns: [deep, legacy, routes, apps, ...extra] }];

const outside = "Інша фіча — лише через @/features/<фіча>.";
const up = [
  { regex: "^\\.\\./", message: outside },
  { regex: "^\\.\\./\\.\\./", message: outside },
];
const unlisted = { regex: "^@/features(/|$)", message: "Нова фіча: додайте її залежності в edges у eslint.config.mjs застосунку." };
const fromShared = "shared не залежить від фіч.";
const fromRoute = "Маршрут складає екран лише з публічного API фіч.";

export function featureBoundaries(edges) {
  const dependsOn = (feature) => ({
    regex: edges[feature].length ? `^@/features/(?!(${edges[feature].join("|")})(/server)?$)` : "^@/features(/|$)",
    message: `Фіча ${feature} залежить лише від: ${edges[feature].join(", ") || "shared"}.`,
  });
  return [
    { files: ["src/**/*.{ts,tsx}"], rules: { "no-restricted-imports": restrict() } },
    {
      files: ["src/shared/**/*.{ts,tsx}"],
      rules: {
        "no-restricted-imports": restrict(
          { regex: "^@/features(/|$)", message: fromShared },
          { regex: "^(\\.\\.?/)+(.*/)?features(/|$)", message: fromShared },
        ),
      },
    },
    { files: ["src/features/*/*.{ts,tsx}"], rules: { "no-restricted-imports": restrict(up[0], unlisted) } },
    { files: ["src/features/*/*/*.{ts,tsx}"], rules: { "no-restricted-imports": restrict(up[1], unlisted) } },
    ...Object.keys(edges).flatMap((feature) => [
      { files: [`src/features/${feature}/*.{ts,tsx}`], rules: { "no-restricted-imports": restrict(up[0], dependsOn(feature)) } },
      { files: [`src/features/${feature}/*/*.{ts,tsx}`], rules: { "no-restricted-imports": restrict(up[1], dependsOn(feature)) } },
    ]),
    {
      files: ["src/app/**/*.{ts,tsx}"],
      rules: {
        "no-restricted-imports": restrict(
          { regex: "^@/shared(/|$)", message: fromRoute },
          { regex: "^@polivalko/shared(/|$)", message: fromRoute },
          { regex: "^\\.\\.?/(?!.*\\.css$)", message: "Маршрут не імпортує сусідні модулі: перенесіть код у фічу." },
        ),
      },
    },
  ];
}
