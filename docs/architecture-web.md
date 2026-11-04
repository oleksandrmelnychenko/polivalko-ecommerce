# Архітектура клієнта (web/)

Документ описує будову Next.js-клієнта PoliValko. З 2026-11-04 це npm workspace із двох застосунків і спільного
пакета:

- **вітрина** `web/apps/shop` — сайт для покупців на `<домен>` (локально http://localhost:8080);
- **консоль** `web/apps/console` — застосунок для працівників на власному піддомені (`CONSOLE_ADDRESS`, локально
  http://console.localhost:8080), маршрути — від кореня хоста (`/`, `/login`, `/orders`, …);
- **спільний пакет** `web/packages/shared` (`@polivalko/shared`) — клієнт і типи API, хелпери, іконки й базові стилі,
  якими користуються обидва застосунки.

Мета обох рефакторингів (фічеве розбиття, потім розділення на два застосунки) — явні межі без зміни поведінки: той
самий HTTP API, ті самі розмітка, класи, тексти, стилі, метадані й поведінка в браузері; змінилися лише адреси
панелі працівників (маршрути від кореня власного хоста, розділ 12). Згодом панель перейменовано на «консоль» (розділ 14).

Версії: Next.js 16 (App Router, `cacheComponents`, `partialPrefetching`), React 19, TypeScript, ESLint 9 (flat config),
npm workspaces (без turbo/pnpm/nx). Перед зміною коду читайте відповідні розділи `web/node_modules/next/dist/docs/`
(див. `web/AGENTS.md`).

## 1. Принципи

1. **Маршрути тонкі.** Файли в `src/app` потрібні лише маршрутизатору: вони тримають `metadata` / `generateMetadata`,
   конфігурацію сегмента (`instant`, тощо), `Suspense`, якщо він є частиною маршруту, і складають екран із публічного
   API фіч. Бізнес-розмітки, запитів і станів у них немає.
2. **Фіча володіє всім своїм:** компонентами, хуками, доступом до даних (серверні функції з `"use cache"` і клієнтські
   виклики `browserApi`), чистою логікою й стилями.
3. **Публічний API фічі — лише `index.ts` і `server.ts`.** Усе інше всередині фічі приватне.
4. **`shared` — нижній шар.** `src/shared` застосунку не знає про фічі й маршрути; `@polivalko/shared` не знає про
   застосунки.
5. **Застосунки не залежать один від одного.** Вітрина не імпортує консоль і навпаки; спільне — лише в
   `@polivalko/shared`, і туди потрапляє тільки те, чим справді користуються обидва.
6. **Межа «клієнт/сервер» мінімальна.** `"use client"` стоїть лише на модулях, які використовують стан, ефекти,
   контекст, обробники подій або API браузера. Серверний код (внутрішня адреса API, `"use cache"`-функції) позначений
   `import "server-only"` і не може потрапити в клієнтський бандл.
7. **Каскад CSS незмінний.** Кожен застосунок підключає лише потрібні йому сегменти, але порядок правил той самий, що
   й у спільному CSS до розділення (розділ 6).

## 2. Шари й напрям залежностей

```
src/app (маршрути)  ──►  src/features/<фіча> (index.ts | server.ts)  ──►  src/shared  ──►  @polivalko/shared
                            │                                   └──────────────────────────────►┘
                            └──► інші фічі цього застосунку лише через їхній index.ts / server.ts
```

| Шар | Може імпортувати | Не може імпортувати |
| --- | --- | --- |
| `src/app/**` | `@/features/<фіча>`, `@/features/<фіча>/server`, `next/*`, `react`, `./globals.css` | `@/shared/**`, `@polivalko/shared/**`, внутрішні файли фіч, сусідні `.ts/.tsx` |
| `src/features/<фіча>/**` | власні файли відносними шляхами, `@/shared/**`, `@polivalko/shared/**`, публічний API інших фіч зі списку `edges` | внутрішні файли інших фіч, відносні шляхи за межі фічі, `@/app/**` |
| `src/shared/**` | `@/shared/**`, `@polivalko/shared/**`, сторонні пакети | `@/features/**`, `@/app/**` |
| `packages/shared/**` | власні файли відносними шляхами, сторонні пакети | `@/…` (псевдоніми застосунків), `shop`, `console`, шляхи в `apps/` і за межі пакета |

Для всіх файлів застосунків заборонені також старі шляхи `@/lib/**` і `@/components/**` та імпорт іншого застосунку
(`shop/…`, `console/…` — npm workspaces створюють такі посилання в `node_modules`).

Циклічних залежностей між фічами немає. Дозволені ребра (фіча → від чого залежить):

- Вітрина (`apps/shop`): `favorites → customer`; `cart → analytics`; `catalog → cart, favorites`;
  `product → catalog, cart, analytics, favorites`; `home → catalog, services, content`;
  `layout → cart, catalog, services, content, search, customer`; `search → catalog`; `checkout → cart, analytics, customer`;
  `order → payment, analytics`; `account → customer, favorites, catalog, cart, checkout, order, payment`; `customer`,
  `services`, `content`, `payment`, `analytics` — лише від `shared`.
- Консоль (`apps/console`): `shell → auth`; `dashboard → shell, orders, catalog`; `orders → shell`; `catalog → auth`;
  `content → auth`; `integration → auth`; `staff → auth`; `audit → auth`; `requests → shell`; `customers`, `auth` —
  лише від `shared`.

Цей список — мапа `edges` в `eslint.config.mjs` кожного застосунку: імпорт фічі, якої немає серед залежностей
(зокрема власного публічного API зсередини фічі), — помилка `npm run lint` (розділ 7).

## 3. Дерево

```
web/
├─ package.json            workspace-корінь: "workspaces": ["apps/*", "packages/*"], скрипти lint/typecheck/build/api:types
├─ package-lock.json       єдиний lock-файл
├─ eslint.boundaries.mjs   спільні правила меж для eslint.config.mjs обох застосунків
├─ AGENTS.md               правила Next.js для агентів (next dev пише таку саму копію в кожен застосунок)
├─ Dockerfile              один образ на застосунок: build-arg APP=shop|console
├─ apps/
│  ├─ shop/                вітрина (workspace "shop")
│  │  ├─ package.json  next.config.ts  tsconfig.json  eslint.config.mjs  AGENTS.md
│  │  └─ src/
│  │     ├─ app/
│  │     │  ├─ layout.tsx  globals.css  not-found.tsx  robots.ts  sitemap.ts  favicon.ico
│  │     │  ├─ internal/revalidate/route.ts
│  │     │  ├─ pay/layout.tsx  pay/sandbox/[id]/page.tsx
│  │     │  └─ (shop)/layout.tsx  error.tsx  page.tsx  cart/ catalog/ catalog/[slug]/ checkout/ contacts/ credits/
│  │     │           offer/ order/[number]/ payment-delivery/ privacy/ product/[slug]/ returns/ search/ services/
│  │     │           account/ login/ register/ forgot-password/ reset-password/ confirm-email/
│  │     │                    (cabinet)/layout.tsx page.tsx orders/ orders/[number]/ favorites/ addresses/ profile/
│  │     ├─ features/
│  │     │  ├─ analytics/   GA4: track, TrackPurchase, TrackViewItem, GoogleAnalytics
│  │     │  ├─ cart/        сховище кошика (localStorage), CartProvider/useCart, useCartQuote, CartButton, CartDrawer,
│  │     │  │               CartScreen/CartView, BuyForm, AddToCart
│  │     │  ├─ catalog/     дерево розділів, пошук товарів, плитки товарів і розділів, лістинг з фільтрами й
│  │     │  │               пейджером, CatalogScreen, CategoryScreen, перенаправлення старих URL, sitemap-дані
│  │     │  ├─ product/     ProductScreen: галерея, блок покупки, варіанти, опис і характеристики, схожі товари, JSON-LD
│  │     │  ├─ home/        HomeScreen: слайдер, лукбук-секції, стрічки (Rail), переваги, кроки, магазин у Бучі
│  │     │  ├─ layout/      хром вітрини: ShopShell, SiteHeader (меню, мегаменю, мобільне меню), SiteFooter, BackToTop
│  │     │  ├─ search/      SearchButton (панель пошуку в шапці), SearchScreen
│  │     │  ├─ checkout/    CheckoutScreen: форма, вибір міста й відділення НП, підсумок, створення замовлення
│  │     │  ├─ order/       OrderScreen: сторінка результату замовлення, чеки, історія
│  │     │  ├─ payment/     PayButton, PaymentPending, SandboxPaymentScreen
│  │     │  ├─ services/    ServicesScreen, ServiceRequestForm, напрямки послуг
│  │     │  ├─ content/     InfoPage, PageHead, ContactsScreen, CreditsScreen, OfferScreen (реквізити продавця)
│  │     │  ├─ customer/    сесія покупця (зовнішнє сховище + підказка в localStorage), CSRF кабінету, вхід/реєстрація/
│  │     │  │               вихід, адреси для оформлення, AccountButton у шапці
│  │     │  ├─ favorites/   сховище id обраного, FavoriteButton (сердечко), список обраних товарів
│  │     │  └─ account/     сторінки кабінету: вхід, реєстрація, відновлення пароля, підтвердження email, AccountShell,
│  │     │                  замовлення, деталі замовлення, обране, адреси, профіль
│  │     └─ shared/
│  │        ├─ lib/quantity.ts (MAX_QUANTITY)   ui/quantity-stepper.tsx   hooks/use-hydrated.ts
│  │        └─ styles/   print.css
│  │           ├─ ui/         stepper, fill, lines, totals, summary-layout (.css)
│  │           └─ responsive/ site, shop (.css)
│  └─ console/             консоль (workspace "console")
│     ├─ package.json  next.config.ts  tsconfig.json  eslint.config.mjs  AGENTS.md
│     └─ src/
│        ├─ app/
│        │  ├─ layout.tsx  globals.css  not-found.tsx  favicon.ico
│        │  └─ (console)/layout.tsx  login/page.tsx
│        │     └─ (panel)/layout.tsx  page.tsx  audit/ catalog/(categories|collections|import|redirects|products/[id])/
│        │                 content/(layout.tsx|contacts|pages/[slug]|pickup|services)/ customers/ integration/
│        │                 orders/ orders/[number]/ requests/ staff/
│        ├─ features/
│        │  ├─ auth/        StaffGate, useStaff, AdminOnly, LoginScreen, вихід
│        │  ├─ shell/       ConsoleShell, useSummary, бічна панель, верхня смуга, сповіщення, палітра Ctrl+K
│        │  ├─ dashboard/   OverviewScreen, графік виручки, KPI, черга, стан інтеграцій
│        │  ├─ orders/      OrdersScreen, OrderDetailScreen, OrdersTable, StatusText, PaymentStatusText, повернення,
│        │  │               оплати й чеки
│        │  ├─ customers/   CustomersScreen
│        │  ├─ requests/    RequestsScreen
│        │  ├─ catalog/     ProductsScreen, ProductEditorScreen, CategoriesScreen, CollectionsScreen, RedirectsScreen,
│        │  │               ImportScreen, CatalogTabs, StockText
│        │  ├─ content/     ContentSectionLayout, ContentPagesScreen, PageEditorScreen, ContactsEditorScreen,
│        │  │               PickupEditorScreen, ServicesEditorScreen
│        │  ├─ integration/ IntegrationScreen (завдання, прогони, черга, Нова пошта)
│        │  ├─ staff/       StaffScreen і форми працівників
│        │  └─ audit/       AuditScreen
│        └─ shared/
│           ├─ csrf.ts (csrfHeader, forgetCsrf, withCsrf)  use-console-data.ts  format.ts (when)  download.ts
│           ├─ site-url.ts (siteUrl — абсолютні посилання на вітрину)
│           ├─ ui/    state-box.tsx, page-head.tsx, modal.tsx, pager.tsx, selection.tsx (useSelection, CheckAll)
│           ├─ form/  field.tsx, check-field.tsx, field-error.tsx, form-status.tsx, save-button.tsx, use-console-form.ts
│           └─ styles/ root, page-head, controls, filters, cards, console-meta, tables, pager, tabs, notices, grids,
│                      actions, forms, modal (.css);  responsive/ console, console-screens (.css)
└─ packages/
   └─ shared/              "@polivalko/shared" — TypeScript-джерела, без збірки (transpilePackages)
      ├─ package.json  tsconfig.json  eslint.config.mjs
      ├─ api/     browser.ts (browserApi, newIdempotencyKey), server.ts (api, server-only), types.ts (псевдоніми DTO),
      │           problem.ts (Problem і хелпери Problem Details), schema.d.ts (ГЕНЕРУЄТЬСЯ, не редагувати)
      ├─ lib/     format.ts, images.ts, labels.ts, stand-in-photos.ts
      ├─ ui/      icons.tsx
      └─ styles/  tokens.css, base.css, layout.css
         └─ ui/   logo, buttons, crumbs, states, page-head, check, seg, pager, buybox-meta, remove, forms, notice, prose,
                  seg-compact, meta-list (.css)
```

Власні `styles/` мають 18 фіч: вітрина — `layout`, `search`, `home`, `catalog`, `product`, `content`, `cart`, `order`,
`checkout`, `services`, `payment`, `customer`, `favorites`, `account`; консоль — `shell`, `auth`, `dashboard`, `orders`. Перелік файлів — розділ 6.2.

Пакет `@polivalko/shared` не має поля `exports` і власної збірки: застосунки імпортують файли за шляхом
(`@polivalko/shared/api/browser`, `@polivalko/shared/lib/format`, `@polivalko/shared/ui/icons`), а Next.js компілює
їх як частину застосунку (`transpilePackages`). npm workspaces створюють посилання
`node_modules/@polivalko/shared → packages/shared`.

### 3.1. Будова фічі

```
src/features/<фіча>/
├─ index.ts        публічний API, безпечний для будь-якого середовища (клієнтські компоненти, типи, хуки,
│                  серверно-сумісні компоненти без запитів)
├─ server.ts       публічний API лише для сервера: серверні функції даних і async-компоненти,
│                  що їх викликають (екрани вітрини)
├─ components/     *.tsx, по одному головному компоненту на файл
├─ hooks/          use-*.ts
├─ api/            client.ts — виклики browserApi; server.ts — функції з "use cache" і import "server-only"
├─ lib/            чиста логіка, константи, типи, підписи
└─ styles/         *.css — сегменти глобального CSS (див. розділ 6)
```

- Вкладеність усередині фічі — не глибше одного рівня (`components/x.tsx`, але не `components/a/x.tsx`).
  Групи файлів позначаємо префіксом: `order-detail-items.tsx`, `product-editor-form.tsx`.
- `index.ts` **ніколи** не реекспортує модуль, що прямо чи транзитивно імпортує `server-only`
  (`api/server.ts`, `@polivalko/shared/api/server`) — інакше клієнтський компонент іншої фічі втягне серверний код у
  бандл і збірка впаде. Усе таке йде через `server.ts`.
- Клієнтські файли імпортують інші фічі лише через `index.ts`.
- Фіча має `index.ts`, `server.ts` або обидва, і експортує лише те, що справді імпортують маршрути чи інші фічі.
  Порожніх `index.ts` і «про запас» реекспортів немає: внутрішні компоненти, хелпери й типи лишаються приватними.

### 3.2. Публічний API фіч

Фактичний вміст `index.ts` і `server.ts` (усе інше в фічі приватне).

Вітрина (`apps/shop/src/features`):

| Фіча | `index.ts` | `server.ts` |
| --- | --- | --- |
| `analytics` | `track`, `TrackPurchase`, `TrackViewItem`, `GoogleAnalytics` | — |
| `cart` | `CartProvider`, `useCart`, `useCartQuote`, `CartButton`, `CartDrawer`, `CartScreen`, `BuyForm`, `AddToCart` | — |
| `catalog` | `ProductTile`, `ProductTiles`, `ProductTilesSkeleton`, `CategoryTile`, `CategoryGrid`, `ListingSkeleton`, `discountPercent`, тип `SearchParams` | `getCategory`, `getCategoryTree`, `getCollections`, `getSitemap`, `resolveRedirect`, `searchProducts`, `CatalogListing`, `CatalogScreen`, `CategoryScreen` |
| `product` | `descriptionText` | `getProduct`, `ProductScreen` |
| `home` | — | `HomeScreen` |
| `layout` | — | `ShopShell` |
| `search` | `SearchButton` | `SearchScreen` |
| `checkout` | `CheckoutScreen`, `SettlementPicker`, `CheckoutWarehouseSelect`, `CheckoutCourierFields`, `useDeliveryPoint`, `fieldProps`, `deliveryHint` | — |
| `order` | `OrderFacts`, `OrderHistory`, `OrderItems`, `OrderReceipts`, `isOrderPaid`, `orderWhere` | `OrderScreen` |
| `payment` | `PayButton`, `PaymentPending`, `SandboxPaymentScreen` | — |
| `services` | — | `getServiceDirections`, `ServicesScreen` |
| `content` | — | `getContacts`, `InfoPage`, `ContactsScreen`, `CreditsScreen`, `OfferScreen` |
| `customer` | `AccountButton`, `useCustomer`, `getAddresses`, `postAddress`, `withCsrf`, тип `CsrfHeaders`, `expireOn401`, `loadSession`, `refreshSession`, `setSignedIn`, `sessionEnded`, `signIn`, `signOut`, `signUp`, `currentPath`, `loginHref`, `safeNext`, `addressPlace`, `addressTitle`, типи `CustomerAddress`, `CustomerMe`, `SaveAddressRequest` | — |
| `favorites` | `FavoriteButton`, `useFavorites`, `getFavoriteProducts`, `HeartIcon` | — |
| `account` | `LoginScreen`, `RegisterScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen`, `ConfirmEmailScreen`, `AccountShell`, `OrdersScreen`, `OrderDetailScreen`, `FavoritesScreen`, `AddressesScreen`, `ProfileScreen` | — |

Консоль (`apps/console/src/features`):

| Фіча | `index.ts` | `server.ts` |
| --- | --- | --- |
| `auth` | `StaffGate`, `useStaff`, `AdminOnly`, `LoginScreen`, `logout` | — |
| `shell` | `ConsoleShell`, `useSummary` | — |
| `dashboard` | `OverviewScreen` | — |
| `orders` | `OrdersScreen`, `OrderDetailScreen`, `OrdersTable`, `StatusText` | — |
| `customers` | `CustomersScreen` | — |
| `requests` | `RequestsScreen` | — |
| `catalog` | `ProductsScreen`, `ProductEditorScreen`, `CategoriesScreen`, `CollectionsScreen`, `RedirectsScreen`, `ImportScreen`, `StockText` | — |
| `content` | `ContentSectionLayout`, `ContentPagesScreen`, `PageEditorScreen`, `ContactsEditorScreen`, `PickupEditorScreen`, `ServicesEditorScreen` | — |
| `integration` | `IntegrationScreen` | — |
| `staff` | `StaffScreen` | — |
| `audit` | `AuditScreen` | — |

## 4. Конвенції

- **Файли:** kebab-case (`checkout-form.tsx`, `use-cart-quote.ts`). Компоненти й типи — PascalCase, хуки — `useX`.
- **Екрани:** тіло сторінки, яке маршрут рендерить цілком, має суфікс `Screen` (`OrderDetailScreen`, `HomeScreen`).
  Екран вітрини з запитами — серверний (експорт із `server.ts`); екран консолі — клієнтський (експорт з `index.ts`).
- **Розмір:** компонентний файл — до ~150 рядків, жоден `.ts/.tsx` не довший за 200 рядків, крім
  `packages/shared/api/schema.d.ts` і `packages/shared/ui/icons.tsx`. Маршрутний файл — до 40 рядків
  (з `generateMetadata` — до 60).
- **`"use client"`** — першим рядком лише там, де є хуки, контекст, обробники подій чи API браузера. Чисті хелпери,
  константи й `api/client.ts` директиви не мають: вони стають клієнтськими, коли їх імпортує клієнтський модуль.
- **Сервер:** `@polivalko/shared/api/server` і кожен `features/*/api/server.ts` починаються з `import "server-only";`
  (Next.js обробляє цей імпорт сам, пакет ставити не треба). Функції з `"use cache"` зберігають ті самі `cacheLife`
  і `cacheTag`: теги скидає `/internal/revalidate` вітрини.
- **API:** браузерні запити — `browserApi` з `@polivalko/shared/api/browser` (відносні `/api/v1/...`, тобто той самий
  хост, через Caddy); серверні запити вітрини — `api` з `@polivalko/shared/api/server` (`API_INTERNAL_URL`). Типи —
  `@polivalko/shared/api/schema` (`paths`, `components`) і псевдоніми в `@polivalko/shared/api/types`.
- **Дані в консолі:** компонент викликає `useConsoleData(key, () => getOrder(number))` з `@/shared/use-console-data`;
  самі запити живуть в `api/client.ts` фічі. Змінні запити — через `withCsrf` з `@/shared/csrf` консолі (один модуль —
  один кешований токен).
- **Посилання консолі на вітрину** (товар «на сайті», сторінка контенту, іконка «Вітрина») — абсолютні, через
  `siteUrl(path)` з `@/shared/site-url` консолі. Внутрішні посилання консолі — від кореня її хоста (`/orders/…`).
- **Контексти** (`CartContext`, `StaffContext`, `SummaryContext`) і модульний стан (кошик у `localStorage`,
  CSRF-токени, сесія покупця, id обраного) створюються рівно в одному модулі.
- **Коментарі** в коді не пишемо.

## 5. Інваріанти рефакторингу

1. Розмітка, класи, тексти, атрибути, `key` і порядок елементів — ті самі. Те саме стосується масивів, фрагментів і
   кількості сусідів на шляху до компонентів з `useId` (`FiltersPanel`, `SettlementPicker`, `Modal`): від цього
   залежать згенеровані `id` (на сторінці пошуку в знімку видно `#_R_…`).
2. Межі `Suspense`, виклики `connection()`, `"use cache"`, `cacheLife`, `cacheTag`, `cache: "no-store"` — без змін.
3. `metadata`, `generateMetadata`, `viewport`, конфігурація сегментів (`instant = false`) лишаються у файлах маршрутів.
4. Таблиця маршрутів `next build` (○ / ◐ / ƒ для кожного шляху) не змінюється; після розділення маршрути консолі
   втратили лише префікс (розділ 12.2).
5. Запити до API ті самі: шляхи, параметри, заголовки (`Idempotency-Key`, `X-CSRF-TOKEN`), тіла, повтор після
   `auth.csrf_invalid`. Префікс API консолі змінився один раз — під час перейменування (розділ 14).
6. Нових залежностей npm немає (npm workspaces — механізм npm, не залежність). `schema.d.ts` лише генерується
   (`npm run api:types`).

## 6. CSS

### 6.1. Як влаштовано

Усі стилі глобальні й підключаються **одним** імпортом `import "./globals.css"` у `src/app/layout.tsx` кожного
застосунку. Next.js не гарантує порядок CSS, імпортованого з різних компонентів, тож компоненти CSS не імпортують.
`src/app/globals.css` — маніфест: лише `@import url("…");` відносними шляхами до сегментів у `src/shared/styles/**`,
`src/features/*/styles/**` цього застосунку і `packages/shared/styles/**` (шлях
`../../../../packages/shared/styles/…`; Turbopack має корінь `web/`, тож ці файли в межах проєкту). Вкладених
`@import` у сегментах немає.

Сегмент — суцільний шматок вихідного файлу. Правило розміщення:

- сегмент, яким користується одна фіча, лежить у цій фічі;
- яким користуються кілька фіч одного застосунку — у `src/shared/styles` цього застосунку;
- правило, яке може зачепити елементи **обох** застосунків, лежить у `packages/shared/styles` і підключене в обох
  маніфестах на тому самому місці каскаду.

Медіаблоки в кінці вихідних файлів змішують правила різних фіч, тож вони лишаються цілими в
`src/shared/styles/responsive/*` свого застосунку: інакше змінився б відносний порядок правил.

Порядок `@import` в обох маніфестах — це порядок спільного `globals.css` до розділення (75 сегментів), з якого
викинуто сегменти, правила яких не можуть зачепити елементи застосунку. Вітрина: 60 рядків, консоль: 43. Початок
`apps/shop/src/app/globals.css`:

```css
@import url("../../../../packages/shared/styles/tokens.css");
@import url("../../../../packages/shared/styles/base.css");
@import url("../../../../packages/shared/styles/layout.css");
@import url("../features/layout/styles/header.css");
@import url("../../../../packages/shared/styles/ui/logo.css");
@import url("../features/layout/styles/header-menu.css");
```

Кінець маніфесту вітрини — три сегменти з правилами, які до розділення вітрина отримувала з CSS консолі
(розділ 12.4): `ui/seg-compact.css`, `ui/meta-list.css` (обидва з пакета) і `src/shared/styles/print.css`.

Новий сегмент додається окремим файлом у `styles/` фічі (або в `src/shared/styles/**` застосунку, або в
`packages/shared/styles/**`, якщо правила потрібні обом) і рядком `@import` у `globals.css` там, де його правила мають
стояти в каскаді. Сегменти не містять `@import` і коментарів, `@media`/`@starting-style`-блоки не розрізаються,
`@keyframes` лежать поруч зі своїм сегментом.

### 6.2. Карта сегментів

Номери рядків — за `git show 583c573:web/src/app/<файл>` (межі припадають на порожні рядки або коментарі).
Порядок у таблицях — порядок `@import` у маніфестах. Шляхи: `shop/…` = `web/apps/shop/src/…`,
`console/…` = `web/apps/console/src/…`, `pkg/…` = `web/packages/shared/…` (підключено в обох застосунках).

`tokens.css` → `pkg/styles/tokens.css`, `base.css` → `pkg/styles/base.css`.

`site.css`:

| Рядки | Вміст | Файл |
| --- | --- | --- |
| 1–11 | body, main, skip-link, .code, .muted | `pkg/styles/layout.css` |
| 12–44 | шапка, меню, підменю, мегаменю | `shop/features/layout/styles/header.css` (`.site-header`, `.site-header__bar`), `pkg/styles/ui/logo.css` (`.logo`), `shop/features/layout/styles/header-menu.css` (`.logo--footer` і далі) |
| 45–53 | дії шапки, .icon-btn, лічильник кошика | `shop/features/layout/styles/header-actions.css` |
| 54–64 | панель пошуку | `shop/features/search/styles/search-panel.css` |
| 65–78 | мобільне меню | `shop/features/layout/styles/mobile-menu.css` |
| 79–85 | кнопка «вгору» | `shop/features/layout/styles/back-to-top.css` |
| 86–106 | кнопки, .link | `pkg/styles/ui/buttons.css` |
| 107–117 | лічильник кількості | `shop/shared/styles/ui/stepper.css` |
| 118–130 | .section, .band--grey, .heading | `shop/features/home/styles/sections.css` |
| 131–133 | .fill | `shop/shared/styles/ui/fill.css` |
| 134–155 | футер | `shop/features/layout/styles/footer.css` |
| 156–162 | хлібні крихти | `pkg/styles/ui/crumbs.css` |
| 163–170 | скелетони й порожні стани | `pkg/styles/ui/states.css` |
| 171–192 | медіаблоки | `shop/shared/styles/responsive/site.css` |

`shop.css`:

| Рядки | Вміст | Файл |
| --- | --- | --- |
| 1–11 | ціни, наявність | `shop/features/catalog/styles/price.css` |
| 12–20 | стрічки на кутах фото | `shop/features/catalog/styles/flashes.css` |
| 21–74 | слайдер першого екрана | `shop/features/home/styles/hero.css` |
| 75–87 | лукбук-секція | `shop/features/home/styles/look.css` |
| 88–108 | стрічка, бічний заголовок, Rail | `shop/features/home/styles/strip.css` |
| 109–209 | плитки товарів і розділів | `shop/features/catalog/styles/tiles.css` |
| 210–219 | переваги | `shop/features/home/styles/perks.css` |
| 220–229 | напрямки послуг на головній | `shop/features/home/styles/directions.css` |
| 230–238 | кроки «Як замовити» | `shop/features/home/styles/steps.css` |
| 239–251 | магазин у Бучі | `shop/features/home/styles/visit.css` |
| 252–256 | .facts-list | `shop/features/product/styles/facts-list.css` |
| 257–263 | .facts | `shop/features/content/styles/facts.css` |
| 264–271 | .page-head, .chips | `pkg/styles/ui/page-head.css` |
| 272–278 | лістинг: .catalog, панель фільтрів | `shop/features/catalog/styles/listing.css` |
| 279–282 | .check | `pkg/styles/ui/check.css` |
| 283–288 | .range, .toolbar | `shop/features/catalog/styles/listing-toolbar.css` |
| 289–305 | .seg | `pkg/styles/ui/seg.css` |
| 306–311 | .pager | `pkg/styles/ui/pager.css` |
| 312–351 | сторінка товару | `shop/features/product/styles/product.css` (до `.buybox h1`), `pkg/styles/ui/buybox-meta.css` (`.buybox__meta`), `shop/features/product/styles/product-info.css` (від `.buybox__card`) |
| 352–365 | шухляда кошика | `shop/features/cart/styles/drawer.css` |
| 366–384 | .line, .remove, .totals | `shop/shared/styles/ui/lines.css` (`.line…`), `pkg/styles/ui/remove.css` (`.remove`), `shop/shared/styles/ui/totals.css` (`.totals`) |
| 385–396 | .checkout, .summary | `shop/shared/styles/ui/summary-layout.css` |
| 397–423 | сторінка кошика | `shop/features/cart/styles/cart-page.css` |
| 424–438 | поля форм, .consent | `pkg/styles/ui/forms.css` |
| 439–445 | .notice | `pkg/styles/ui/notice.css` |
| 446–456 | сторінка замовлення | `shop/features/order/styles/order.css` |
| 457–463 | підказки міст (.combo) | `shop/features/checkout/styles/combo.css` |
| 464–471 | послуги | `shop/features/services/styles/services.css` |
| 472–482 | .prose, .spec | `pkg/styles/ui/prose.css` |
| 483–485 | контакти | `shop/features/content/styles/contacts.css` |
| 486–488 | .pay | `shop/features/payment/styles/pay.css` |
| 489–491 | .receipts | `shop/features/order/styles/receipts.css` |
| 492–500 | тестова платіжна сторінка | `shop/features/payment/styles/paypage.css` |
| 501–578 | медіаблоки | `shop/shared/styles/responsive/shop.css` |
| 579–585 | автори фото | `shop/features/content/styles/credits.css` |

`admin.css`:

| Рядки | Вміст | Файл |
| --- | --- | --- |
| 1–26 | змінні .console, .console-loading | `console/shared/styles/root.css` |
| 27–66 | каркас: бічна панель, верхня смуга | `console/features/shell/styles/shell.css` |
| 67–82 | заголовок сторінки | `console/shared/styles/page-head.css` |
| 83–151 | поля, прапорці, кнопки, .seg | `console/shared/styles/controls.css` (поля, прапорці, кнопки), `pkg/styles/ui/seg-compact.css` (`.seg` з кнопками) |
| 152–165 | рядок фільтрів | `console/shared/styles/filters.css` |
| 166–187 | картки, панелі, .readonly | `console/shared/styles/cards.css` (до `.readonly dd`), `pkg/styles/ui/meta-list.css` (`dl.buybox__meta`), `console/shared/styles/console-meta.css` (`.console-meta`) |
| 188–228 | таблиці, чипи статусів | `console/shared/styles/tables.css` |
| 229–242 | пейджер | `console/shared/styles/pager.css` |
| 243–253 | вкладки | `console/shared/styles/tabs.css` |
| 254–266 | повідомлення й стани | `console/shared/styles/notices.css` |
| 267–275 | сітки | `console/shared/styles/grids.css` |
| 276–285 | вхід | `console/features/auth/styles/login.css` |
| 286–325 | медіаблоки | `console/shared/styles/responsive/console.css` |
| 326–328 | висота кнопок у фільтрах і формах | `console/shared/styles/actions.css` |

`admin-extra.css`:

| Рядки | Вміст | Файл |
| --- | --- | --- |
| 1–38 | огляд: тривоги, черга, KPI, сітка | `console/features/dashboard/styles/overview.css` |
| 39–59 | графік | `console/features/dashboard/styles/chart.css` |
| 60–83 | списки-стовпчики, рейтинги | `console/features/dashboard/styles/lists.css` |
| 84–94 | масові дії | `console/features/orders/styles/bulk.css` |
| 95–130 | палітра Ctrl+K, сповіщення | `console/features/shell/styles/palette.css` |
| 131–156 | замовлення | `console/features/orders/styles/order.css` |
| 157–214 | редактори, форми, контент | `console/shared/styles/forms.css` |
| 215–247 | медіаблоки | `console/shared/styles/responsive/console-screens.css` |
| 248–263 | друк накладної | `console/features/orders/styles/print.css` (вітрина має власну копію двох правил — `shop/shared/styles/print.css`, розділ 12.4) |
| 264–283 | модальне вікно | `console/shared/styles/modal.css` |

### 6.3. Перевірка каскаду

Скрипт `css-cascade.mjs` (робочий інструмент оркестратора, не частина репозиторію) розгортає `@import` з
`globals.css`, прибирає коментарі, розбиває списки селекторів і друкує по одному правилу на рядок разом із
медіаконтекстом.

Фактичний результат фічевого розбиття (до розділення застосунків): вивід збігався з базовим побайтно (1300 правил).
Зібраний CSS лишився одним файлом, але Turbopack починає вміст кожного імпортованого файлу з нового рядка (на межах
файлів додаткові `\n`, на каскад не впливають).

Після розділення (розділ 12.4) з 1300 правил: 184 — у пакеті (підключені в обох застосунках), 581 — лише у вітрині,
535 — лише в консолі; ще 2 правила друку консолі вітрина має як власну копію. Вивід `css-cascade.mjs` для
`apps/shop/src/app/globals.css` (767 правил) і `apps/console/src/app/globals.css` (719 правил) — це базовий вивід із
викинутими рядками, тобто підпослідовність у тому самому порядку; так само зібраний CSS кожного застосунку
(`apps/*/.next/static/chunks/*.css`, 777 і 729 правил разом з `@font-face`) — підпослідовність зібраного CSS до
розділення.

## 7. Межі в ESLint

Лише вбудоване правило `no-restricted-imports` з `regex`. У flat config пізніший блок для тих самих файлів повністю
замінює налаштування правила, тому кожен блок містить спільні заборони плюс свої. Блоки однакові для обох застосунків,
тож їх будує функція `featureBoundaries(edges)` з `web/eslint.boundaries.mjs`; кожен застосунок передає свою мапу
`edges` (розділ 2):

- усі файли `src/**`: лише публічний API фіч (`index.ts` або `/server`), жодних `@/lib`, `@/components`, `@/app`,
  жодного імпорту іншого застосунку (`shop/…`, `console/…`);
- `src/shared/**`: ще й жодного `@/features` (ні псевдонімом, ні відносним шляхом);
- `src/features/<фіча>/**`: відносні шляхи не виходять за межі фічі, а `@/features/...` дозволено лише для фіч зі
  списку `edges[фіча]`. Фіча, якої немає в `edges`, не може імпортувати жодної іншої, доки її не додано в мапу;
- `src/app/**`: ще й жодного `@/shared`, `@polivalko/shared` і відносних імпортів, крім `.css`.

Пакет `packages/shared` має власний `eslint.config.mjs`: заборонені `@/…`, `shop`, `console`, сам
`@polivalko/shared`, будь-який шлях з `apps/` і відносні шляхи за межі пакета (`../../` з файлів `api/`, `lib/`, `ui/`).

Перевірено тимчасовими порушеннями (потім видаленими): маршрут з `@/shared/...` чи `@polivalko/shared/...`;
`catalog`, що імпортує `analytics`; `analytics` → `cart`; глибокий `@/features/cart/lib/...`; `../../cart/...` з
фічі; нова фіча поза `edges`; `src/shared` → `@/features`; фіча вітрини → `console/src/...`; фіча консолі →
`shop/src/...`; `auth` → `shell`; пакет → `@/shared/...`, `shop/...`, `../../../apps/...` — кожне дає помилку
`npm run lint`, а дозволені ребра (`catalog → cart`, `shell → auth`, відносні імпорти всередині пакета) проходять.

`web/eslint.boundaries.mjs`:

```js
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
```

`web/apps/shop/eslint.config.mjs` (консоль — так само, зі своєю мапою `edges` з розділу 2):

```js
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
```

Що ESLint не ловить і що ловить збірка: клієнтський модуль, який через `server.ts` дотягнувся до `server-only`,
дає помилку `next build`.

## 8. Як додати фічу

1. Створіть `apps/<shop|console>/src/features/<назва>/` з `index.ts` та/або `server.ts` (серверні дані чи
   async-екран) і додайте фічу з її залежностями в `edges` у `apps/<shop|console>/eslint.config.mjs` та в розділ 2.
2. Запити: браузерні — функції в `api/client.ts` поверх `browserApi` з `@polivalko/shared/api/browser`; серверні — у
   `api/server.ts` з `import "server-only"`, `api` з `@polivalko/shared/api/server`, `"use cache"`, `cacheLife` і
   `cacheTag` (тег має скидатися через `/internal/revalidate`). Типи — з `@polivalko/shared/api/schema` або
   `@polivalko/shared/api/types`.
3. Компоненти — у `components/`, хуки — у `hooks/`, чисті функції й підписи — у `lib/`.
   `"use client"` — лише на інтерактивних листках.
4. Експортуйте назовні тільки те, що потрібно маршрутам і іншим фічам. Серверні речі — лише з `server.ts`.
5. Маршрут у `src/app/...` імпортує екран з `@/features/<назва>` (або `/server`), тримає `metadata`
   і конфігурацію сегмента.
6. Стилі: новий сегмент `styles/<назва>.css` у фічі і рядок `@import` у `src/app/globals.css` застосунку на потрібному
   місці каскаду. Правила, потрібні обом застосункам, — у `packages/shared/styles` і в обох маніфестах.
7. Спільний з іншим застосунком код (не стилі) — лише в `packages/shared`, і лише якщо ним справді користуються обидва.
8. Перевірте з `web/`: `npm run typecheck`, `npm run lint`, `npm run build`.

## 9. Карта перенесення (з 583c573)

Шляхи в цьому розділі й у розділі 11 — стан до розділення на два застосунки (3370b40); актуальні — розділ 12.1.
Імена файлів, хуків, компонентів і класів у цих двох розділах теж історичні: 04.11.2026 застосунок і його код
перейменовано на «консоль» (розділ 14).

| Було | Стало |
| --- | --- |
| `lib/api/schema.d.ts` | `shared/api/schema.d.ts` (скрипт `api:types` і рядок у `.github/workflows/ci.yml`) |
| `lib/api/browser.ts`, `lib/api/server.ts` | `shared/api/browser.ts`, `shared/api/server.ts`, `shared/api/types.ts`, `shared/api/problem.ts` |
| `lib/format.ts`, `images.ts`, `labels.ts`, `stand-in-photos.ts` | `shared/lib/*` |
| `lib/analytics.tsx` | `features/shop/analytics` |
| `lib/cart.tsx`, `lib/quote.ts` | `features/shop/cart` (`lib/cart-store.ts`, `components/cart-provider.tsx`, `hooks/use-cart-quote.ts`, `api/client.ts`) |
| `lib/catalog.ts` | `catalog/api/server.ts` (розділи, товари, добірки, sitemap, redirect), `product/api/server.ts` (getProduct), `services/api/server.ts`, `content/api/server.ts` (сторінки, контакти, самовивіз, продавець, автори фото) |
| `lib/admin.tsx` | `shared/admin/csrf.ts`, `shared/admin/use-admin-data.ts`, `features/admin/auth` (StaffGate, useStaff) |
| `components/icons.tsx`, `quantity-stepper.tsx` | `shared/ui/*` |
| `components/add-to-cart.tsx`, `cart-button.tsx`, `cart-drawer.tsx` | `features/shop/cart/components/*` |
| `components/catalog-listing.tsx`, `filters-panel.tsx`, `category-cards.tsx`, `product-card.tsx` | `features/shop/catalog/*` |
| `components/gallery.tsx` | `features/shop/product/components/gallery.tsx` |
| `components/hero-slider.tsx`, `rail.tsx` | `features/shop/home/components/*` |
| `components/site-header.tsx`, `site-footer.tsx`, `main-nav.tsx`, `mobile-menu.tsx`, `back-to-top.tsx` | `features/shop/layout/*` |
| `components/search-panel.tsx` | `features/shop/search/components/search-button.tsx` |
| `components/info-page.tsx` | `features/shop/content` |
| `app/(shop)/**/*.tsx` (окрім `page.tsx`/`layout.tsx`/`error.tsx`) | відповідні фічі вітрини |
| `app/pay/sandbox/[id]/page.tsx` (тіло) | `features/shop/payment` (SandboxPaymentScreen) |
| `app/admin/(panel)/ui.tsx` | `shared/admin/ui/*` (StateBox, PageHead, Modal, Pager, selection, downloadFile), `admin/orders` (OrdersTable, StatusText, PaymentStatusText), `admin/catalog` (StockText), `admin/dashboard` (Delta) |
| `app/admin/(panel)/catalog/_shared.tsx` | `shared/admin/csrf.ts` (`mutate` = `withCsrf`), `shared/api/problem.ts`, `shared/admin/form/field-error.tsx`, `admin/catalog` (CatalogTabs, AdminOnlyNotice) |
| `app/admin/(panel)/content/_lib.tsx` | `shared/admin/form/*`, `shared/admin/format.ts`, `shared/api/problem.ts`, `admin/auth` (AdminOnly), `admin/content` (ContentNav) |
| `app/admin/(panel)/admin-shell.tsx`, `command-palette.tsx` | `features/admin/shell` |
| `app/admin/(panel)/revenue-chart.tsx` | `features/admin/dashboard` |
| `app/admin/login/login-form.tsx` | `features/admin/auth` |
| `app/*.css` | розділ 6 |

Два різні `AdminOnly` не об'єднуються: варіант з `content/_lib` (заголовок і `role="status"`) стає `AdminOnly` у
`admin/auth`, варіант з `catalog/_shared` (лише `p.notice`) — `AdminOnlyNotice` у `admin/catalog`.
Так само різні `PageHead` вітрини (`shop/content`) і консолі (`shared/admin/ui`) і різні пейджери.

## 10. Перевірки

```
cd web
npm ci
npm run typecheck                   # next typegen + tsc --noEmit в обох застосунках, tsc --noEmit у пакеті
npm run lint                        # eslint у shop, console і packages/shared
npm run build                       # next build обох застосунків; таблиці маршрутів — як у розділі 12.2
npm run api:types && git diff --exit-code -- packages/shared/api/schema.d.ts
```

Окремий застосунок: `npm run <скрипт> -w shop`, `-w console` або `-w @polivalko/shared`.

Плюс знімки сторінок (DOM і пікселі, 1440 і 375 px) зібраних Docker-образів проти базових і перевірка каскаду CSS
(розділ 6.3).

## 11. Уточнення й відхилення, зроблені під час перенесення

Пакет 1 (спільний шар і фічі вітрини):

- **Оформлення замовлення.** `useCheckout(formRef)` отримує ref форми від `CheckoutForm`, а не створює й не повертає його
  сам: правило `react-hooks/refs` забороняє читати під час рендеру об'єкт, що містить ref. Хелпери `field()` і
  `fieldError()` перенесено без змін у `checkout/lib/field-props.tsx` (файл `.tsx` у `lib/`, бо `fieldError` повертає
  JSX), типи `Errors` і `Notice` — у `checkout/lib/types.ts`.
- **Метадані товару.** Маршрут не може імпортувати `@/shared`, тому `product/index.ts` експортує `descriptionText`
  (`product/lib/description.ts`: `plainText(html).join(" ").slice(0, 160)`); `generateMetadata` дає той самий опис.
- **Браузерні запити.** Окрім `cart` і `checkout`, свої `api/client.ts` мають `services` (`createServiceRequest`) і
  `payment` (`startPayment`, `getSandboxInvoice`, `completeSandboxInvoice`).
- **Дрібніше розбиття.** `product-card.tsx` → `catalog/components/product-tile.tsx`, `product-tiles.tsx`,
  `product-tiles-skeleton.tsx`, `catalog/lib/discount.ts`, `catalog/lib/cart-product.ts`; `category-cards.tsx` →
  `category-tile.tsx`, `category-grid.tsx`; шапка розділу — `catalog/components/category-head.tsx`;
  `add-to-cart.tsx` → `cart/components/buy-form.tsx` і `add-to-cart.tsx`; `credits` — `content/lib/source-page.ts`;
  телефон на сторінці контактів — `content/components/contacts-phone.tsx`.
- **`"use client"`** стоїть також на модулях хуків (`use-hydrated.ts`, `use-cart-quote.ts`, `use-checkout.ts`,
  `use-admin-data.ts`). `GoogleAnalytics` лишився клієнтським компонентом, як і був, щоб дерево кореневого макета не
  змінилося. Дочірні компоненти клієнтських екранів (`cart-lines.tsx`, `checkout-*.tsx` тощо) директиви не мають:
  їх імпортують лише клієнтські модулі своєї фічі.
- **`StaffMe`** визначено в `features/admin/auth/components/staff-gate.tsx` (з рев'ю — приватний тип, див. нижче).
- **`index.ts` без зовнішніх споживачів** спершу додано всім фічам заради однакової будови; рев'ю їх прибрало
  (див. «Рев'ю» нижче).
- **`pay/sandbox/[id]/page.tsx`** — серверний файл маршруту без `"use client"`, що рендерить `SandboxPaymentScreen`;
  таблиця маршрутів і розмітка сторінки не змінилися.
- **Тимчасово до пакета 2.** `problemOf`, `problemText`, `problemTitle`, `fieldErrors` уже є в
  `shared/api/problem.ts`, а `withCsrf` — у `shared/admin/csrf.ts`, але їхні копії (і `mutate`) ще лежать у
  `app/admin/(panel)/content/_lib.tsx` і `catalog/_shared.tsx`; у консолі змінено лише шляхи імпорту. CSRF-токен
  зберігає тільки `shared/admin/csrf.ts`. Блок ESLint для `src/app/**` поки охоплює `src/app/*.{ts,tsx}`, `(shop)`,
  `pay` і `internal`; маршрути консолі приєднаються в пакеті 2.

Пакет 2 (фічі консолі):

- **Тимчасовий стан пакета 1 усунуто.** Копії `problemOf`, `problemText`, `problemTitle`, `fieldErrors`, `withCsrf` і `mutate`
  видалено разом із `content/_lib.tsx` і `catalog/_shared.tsx`; `mutate` скрізь замінено на `withCsrf`. Блок ESLint для
  маршрутів тепер охоплює весь `src/app/**/*.{ts,tsx}`, зокрема консоль. У `src/app/admin` лишилися тільки `page.tsx` і
  `layout.tsx`; усі вони серверні (без `"use client"`), рендерять клієнтський екран фічі, і таблиця маршрутів не змінилася.
  `content/layout.tsx` — серверний макет, що рендерить клієнтський `ContentSectionLayout`.
- **Ребро `requests → shell`.** Екран заявок показує лічильник нових заявок і оновлює його після зміни статусу через
  `useSummary`, тож `requests` залежить від `shell` (у розділі 2 виправлено).
- **Файли з JSX у `lib/`.** `shell/lib/nav.tsx` (групи меню з іконками) і `shell/lib/palette-items.tsx` (побудова груп
  палітри Ctrl+K з іконками) мають розширення `.tsx`, бо містять JSX.
- **Палітра Ctrl+K.** Результати рендерить окремий `shell/components/palette-results.tsx`. Лічильник `index += 1` під час
  рендеру правило `react-hooks/immutability` в окремому компоненті забороняє, тому порядковий номер пункту рахується з
  наперед обчислених зсувів груп; номери, `id` і `aria-selected` ті самі.
- **Запити.** Функції `api/client.ts` змінних запитів приймають заголовки першим аргументом (`CsrfHeaders` тепер
  експортується з `shared/admin/csrf.ts`) і викликаються всередині `withCsrf` або `useAdminForm().submit`. Тіла запитів
  будуються там само, де й раніше, тож порядок полів у JSON не змінився. Завантаження фото товару (`uploadProductImage`) і
  імпорт каталогу (`importCatalog`) лишилися на `fetch` з `FormData` і власним повтором після `auth.csrf_invalid`, як і
  були; повернення коштів перейшло на `withCsrf` (той самий виклик `browserApi`). `auth/api/client.ts` має `getMe`,
  `login` і `logout` (`logout` викликає `forgetCsrf`, а перехід на `/admin/login` лишився у верхній смузі). Дзвоник у
  `shell` має власний `getNewOrders`, бо `shell` не залежить від `orders`.
- **Де живе стан.** `useOrderStatusChange` викликається в `OrderDetailScreen` (як і раніше, стан причини й зайнятості
  належить екрану), результат передається в `OrderDetailStatusPanel`. Стан форми повернення — у хуку `orders/hooks/use-refund.ts`,
  який викликає секція `OrderRefunds`, а `OrderRefundForm` лише рендерить форму: стан, як і раніше, переживає зникнення
  форми. Поле пошуку (`text`) фільтрів замовлень, товарів і журналу живе у компонентах фільтрів, які монтуються разом з
  екраном; «Скинути» викликає `reset()` з хуків `use-orders-query.ts` / `use-products-query.ts`. Онлайн-оплати й чеки —
  окремі `OrderPayments` і `OrderReceipts` з тими самими ключами `useAdminData` і тим самим порядком запитів;
  `PaymentsAndReceipts` їх лише складає.
- **Дрібніше розбиття.** Окрім запланованого: `catalog` — `products-filters`, `products-table`, `products-bulk-bar`,
  `hooks/use-products-query.ts`, `lib/product-filters.ts`, `lib/types.ts`, `collections-items.tsx`; `orders` —
  `lib/types.ts`; `dashboard` — `lib/types.ts`, `lib/share.ts`; `content` — `content-nav.tsx`, `contacts-form.tsx`,
  `pickup-form.tsx`, `direction-form.tsx`, `page-editor.tsx`; `staff` — `staff-table.tsx`; `customers` —
  `customers-table.tsx`, `lib/initials.ts`, `lib/customer-sort.ts`; `requests` — `requests-table.tsx`; `integration` —
  `RunCell` живе в `integration-jobs.tsx`, `ErrorText` і `Failures` — в `error-text.tsx`.
- **`"use client"`** стоїть на всіх екранах консолі, на компонентах і модулях з хуками, на `use-admin-form.ts`, на
  публічному `OrdersTable` і на модулях з обробниками подій у `shared/admin/ui` (`state-box`, `modal`, `pager`,
  `selection`) та `shared/admin/form/check-field.tsx`. `LoginScreen` директиви не має: як і колишній `login/page.tsx`, він
  серверно-сумісний і рендерить клієнтський `LoginForm` у `Suspense`.
- **`LOW_STOCK`** лишився внутрішньою константою `catalog/components/stock-text.tsx`: поза `StockText` його ніхто не
  використовує.

Пакет 3 (CSS за фічами й фінальний аудит):

- **Розбиття CSS.** Шість файлів `app/*.css` розрізано рівно за таблицями розділу 6.2, без зсуву жодної межі; старі
  файли видалено, у `src/app` лишилися тільки файли маршрутів, `globals.css` і `favicon.ico`. Текст правил перенесено
  побайтно, коментарі (зокрема ті, що стояли в кінці рядка після правила чи оголошення) прибрано, кілька порожніх рядків
  поспіль зведено до одного. Межі `.check` (рядки 279–282) і `.range`/`.toolbar` (283–288) у `shop.css` не припадають на
  порожній рядок, але розріз усередині суцільного блоку порядку правил не змінює, тож їх лишено як у таблиці.
- **Зібраний CSS** відрізняється від базового лише 69 символами нового рядка на межах імпортованих файлів (розділ 6.3);
  вивід `css-cascade.mjs` збігається побайтно.
- **`ContentSectionLayout`** більше не має `"use client"`: у ньому немає хуків чи обробників, він лише складає
  клієнтські `AdminOnly` і `ContentNav`. Тепер це серверно-сумісний компонент, тож межа клієнта проходить по
  `AdminOnly`/`ContentNav`; розмітка, таблиця маршрутів і знімки не змінилися. Решта модулів з `"use client"` (95 → 94)
  справді використовують стан, ефекти, контекст, обробники подій чи API браузера, або є обов'язковою клієнтською
  точкою входу (`(shop)/error.tsx`, `GoogleAnalytics`).
- **Аудит.** Старих шляхів `@/lib/` і `@/components/` немає; жоден `index.ts` і жоден клієнтський модуль транзитивно не
  доходить до `server-only`; фактичні ребра між фічами збігаються з розділом 2; вкладеність у фічах — один рівень;
  жоден `.ts/.tsx` (крім `schema.d.ts` та `icons.tsx`) не довший за 200 рядків, жоден компонент — за 150, жоден
  маршрут — за 40 (з `generateMetadata` — за 60). Невикористані ще в 583c573 експорти аудит лишив; їх прибрало рев'ю.

Рев'ю (перевірка всього рефакторингу клієнта):

- **Межі між фічами тепер перевіряє ESLint.** Раніше лінтер ловив лише глибокі імпорти, відносні виходи за межі фічі й
  `@/shared` у маршрутах, але пропускав будь-яке ребро між фічами: `shop/catalog → admin/auth`, цикл
  `shop/analytics → shop/cart → shop/analytics`, імпорт фічею власного `index.ts`. Додано мапу `edges` (розділи 2 і 7);
  фактичні імпорти їй відповідають, `npm run lint` чистий.
- **Публічний API звужено до справжніх споживачів.** З `index.ts`/`server.ts` прибрано реекспорти, які ніхто поза
  фічею не імпортував: `GA_ID`, `itemsValue`, `AnalyticsItem`, `CartView`, `CartLine`, `CartProduct`, `CategoryItem`,
  `toCartProduct`, `PAGE_SIZE`, `ProductQuery`, `CheckoutForm`, `Gallery`, `getPage`, `getPhotoCredits`,
  `getPickupPoints`, `getSeller`, `SiteHeader`, `SiteFooter`, `getOrderAndReceipts`, `StaffMe`, `CatalogTabs`,
  `PaymentStatusText`. Порожні після цього `index.ts` фіч `home`, `layout`, `order`, `services`, `content` видалено:
  їхній публічний API — лише `server.ts` (розділ 3.2).
- **Дубльовані псевдоніми DTO** зібрано в `lib/types.ts` своєї фічі: `OrderRow` (`orders`, був у трьох файлах),
  `AdminCollection`, `ProductRow`, `ImportRun` (`catalog`), `Job` (`integration`, новий `lib/types.ts`),
  `RequestStatus` (`requests`, новий `lib/types.ts`); `admin/content` бере `Contacts` з `@/shared/api/types`, а не
  оголошує вдруге.
- **`analytics/components/track-components.tsx`** розділено на `track-purchase.tsx` і `track-view-item.tsx` (по одному
  компоненту на файл, тіла без змін). Клієнтських модулів через це 95.
- **Мертвий код:** прибрано невикористані `QuoteLine`, `PhotoCredit`, `ContentPage`, `Seller` (`shared/api/types.ts`),
  `ArrowUpRightIcon`, `BoxIcon` (`shared/ui/icons.tsx`); `ContactName` і `StandIn` більше не експортуються.
- **Поведінку перевірено** порівнянням із 583c573: множини рядкових літералів, текстів JSX і класів збігаються (різниця
  лише в іменах пропсів нових компонентів і в об'єднаних дублікатах шляхів API); кількість викликів хуків, `connection()`,
  `"use cache"`/`cacheLife`/`cacheTag`, `cache: "no-store"` та сегментної конфігурації та сама; CSRF (`withCsrf` замість
  `mutate` і ручного повтору), кошик у `localStorage`, події GA4, палітра Ctrl+K і `Modal` перенесені без змін логіки.

## 12. Розділення на вітрину й консоль (з 3370b40)

Панель працівників винесено в окремий застосунок Next.js на власному піддомені (тепер — консоль, розділ 14); вітрина
лишилася без жодного її коду й готова до особистого кабінету покупця. Поведінка обох не змінилася, окрім адрес панелі
(маршрути від кореня власного хоста).

### 12.1. Карта перенесення

| Було (`web/`) | Стало (`web/`) |
| --- | --- |
| `package.json` (один застосунок) | `package.json` — корінь workspace (`apps/*`, `packages/*`), скрипти `lint`, `typecheck`, `build`, `api:types` запускають скрипти workspace-ів; `apps/shop/package.json`, `apps/console/package.json`, `packages/shared/package.json`. Залежності переїхали туди, де їх використовують: `openapi-fetch` і `openapi-typescript` — у пакет, `next`/`react`/`react-dom` і інструменти — у застосунки; версії й `package-lock.json` (окрім записів workspace-ів) ті самі |
| `next.config.ts`, `tsconfig.json`, `eslint.config.mjs` | по одному в кожному застосунку; `eslint.boundaries.mjs` у корені; `packages/shared/{tsconfig.json,eslint.config.mjs}` |
| `src/app/layout.tsx`, `globals.css`, `not-found.tsx`, `robots.ts`, `sitemap.ts`, `favicon.ico`, `(shop)/**`, `pay/**`, `internal/**` | `apps/shop/src/app/…` (без змін, крім `globals.css`) |
| `src/app/admin/layout.tsx` | `apps/console/src/app/(console)/layout.tsx` (`div.console`, `instant = false`); метадані (`title`, `robots`) — у новому кореневому `apps/console/src/app/layout.tsx` |
| `src/app/admin/login/page.tsx`, `src/app/admin/(panel)/**` | `apps/console/src/app/(console)/login/page.tsx`, `apps/console/src/app/(console)/(panel)/**` |
| — | `apps/console/src/app/layout.tsx` (html, шрифт Onest, skip-link), `not-found.tsx`, `favicon.ico` (копія) |
| `src/features/shop/<фіча>/**` | `apps/shop/src/features/<фіча>/**` (рівень області прибрано: `@/features/shop/cart` → `@/features/cart`) |
| `src/features/admin/<фіча>/**` | `apps/console/src/features/<фіча>/**` (`@/features/admin/orders` → `@/features/orders`) |
| `src/shared/admin/**` | `apps/console/src/shared/**` (`@/shared/admin/csrf` → `@/shared/csrf`) |
| `src/shared/api/**` | `packages/shared/api/**` (`@polivalko/shared/api/…`) |
| `src/shared/lib/format.ts`, `images.ts`, `labels.ts`, `stand-in-photos.ts` | `packages/shared/lib/*` |
| `src/shared/ui/icons.tsx` | `packages/shared/ui/icons.tsx` |
| `src/shared/lib/quantity.ts`, `ui/quantity-stepper.tsx`, `hooks/use-hydrated.ts` | `apps/shop/src/shared/…` (лише вітрина) |
| `src/shared/styles/**`, `src/features/*/*/styles/**` | розділ 6.2 |

У `packages/shared` лише те, чим користуються обидва застосунки. Виняток — `api/server.ts`: зараз його імпортує тільки
вітрина, але це частина клієнта API поруч з `browser.ts` і згенерованою схемою.

### 12.2. Маршрути й адреси

- Маршрути консолі — від кореня її хоста: `/`, `/login`, `/orders`, `/orders/[number]`, `/customers`, `/requests`,
  `/catalog`, `/catalog/products/[id]`, `/catalog/categories|collections|redirects|import`, `/content`,
  `/content/pages/[slug]`, `/content/contacts|services|pickup`, `/integration`, `/staff`, `/audit`. Префікс прибрано з
  усіх `href`, `router.push/replace`, пунктів меню й палітри Ctrl+K, вкладок, посилань журналу, переходу на вхід
  (`/login?next=…`) і після входу. Таблиця маршрутів `next build` консолі — та сама, що була до розділення, лише без
  префікса (усі ○, крім ◐ `/catalog/products/[id]`, `/content/pages/[slug]`, `/orders/[number]`); вітрини — без змін.
- Палітра Ctrl+K показує шлях розділу другим рядком і будує з нього `id` пункту (`#palette-/orders`).
- Після входу консоль переходить на `next`, лише якщо це локальний шлях (`/…`, але не `//…` чи `/\…`), інакше на `/`
  (`features/auth/lib/next-path.ts`).
- Шляхи API консолі — `/api/v1/console/...` (розділ 14). Браузер консолі звертається до `/api` власного хоста; Caddy
  передає їх в API, тож cookie `pv_console` і `pv_csrf` (host-only, `SameSite=Strict`) ставляться на хост консолі.
- Посилання консолі на вітрину абсолютні: `siteUrl(path)` з `apps/console/src/shared/site-url.ts` →
  `${SITE_URL}${path}`. Це «На сайті» в таблиці товарів, посилання в блоці Navkolo редактора товару, у складі
  замовлення, адреса сторінки в списку й редакторі контенту, іконка «Вітрина» у верхній смузі (тепер звичайний `<a>`
  замість `Link`, розмітка та сама). `SITE_URL` вбудовується під час збірки через `env` у
  `apps/console/next.config.ts` (за замовчуванням `http://localhost:8080`).
- Сторінка 404 консолі має ту саму розмітку, що й 404 вітрини (посилання «Poli Valko» і «Перейти до каталогу» —
  абсолютні, на вітрину).
- Вітрина консолі не знає: невідома адреса на домені магазину — звичайна сторінка 404 вітрини, а `/api/v1/console/*`
  там закриває Caddy (404). `robots.txt` вітрини консолі не згадує; `/account` у ньому — з розділу 13.

### 12.3. Збірка, Docker, Caddy, змінні

- **Dockerfile** (`web/Dockerfile`, контекст `web/`) один для обох: `ARG APP=shop|console`. Етап `deps` ставить
  workspace за `package-lock.json` і трьома `package.json`, `build` виконує `npm run build -w $APP`, `runtime`
  копіює `apps/$APP/.next/standalone` (корінь трасування — `web/`, тож `server.js` лежить в `apps/$APP/`) і
  `apps/$APP/.next/static`, робочий каталог — `/app/apps/$APP`. Копіювання порожнього `public/` прибрано: каталогу
  немає в git.
- **next.config.ts** обох застосунків: `output: "standalone"`, `outputFileTracingRoot` і `turbopack.root` = `web/`,
  `transpilePackages: ["@polivalko/shared"]`, ті самі `cacheComponents`, `partialPrefetching`, `poweredByHeader` і
  `rewrites` `/api/*` → `API_INTERNAL_URL` (для `next dev`).
- **compose.yaml:** сервіс `web` (вітрина, `APP: shop`) як був; `console` (профіль `app`, образ
  `polivalko-console`, `APP: console`, build-arg і змінна `SITE_URL`, `API_INTERNAL_URL`, healthcheck `GET /login`);
  `caddy` залежить і від `console`. Staging — образ `polivalko-staging-console`, `SITE_URL` staging.
- **Caddyfile:** сайт вітрини `{$SITE_ADDRESS::8080}` (заголовки безпеки, `SEARCH_INDEXING`, `/api/v1/console/*` →
  404, `/api/*` і `/health/*` → API, `/internal/*` → 404, решта → `web:3000`). Сайт консолі
  `{$CONSOLE_ADDRESS:http://console.localhost:8080}`: ті самі заголовки безпеки, завжди `X-Robots-Tag: noindex, nofollow`,
  запити з адрес поза `CONSOLE_ALLOWED_IPS` — 404, далі ті самі `/api/*`, `/health/*`, `/internal/*`, решта →
  `console:3000`. Правила обох сайтів стоять у блоці `route`, тож виконуються в порядку запису. Спільні частини —
  сніпети `security` і `api`. Локально обидва сайти слухають `:8080` контейнера, Caddy розрізняє їх за `Host`
  (`*.localhost` браузери ведуть на 127.0.0.1).

| Змінна | Де | За замовчуванням | Призначення |
| --- | --- | --- | --- |
| `CONSOLE_ADDRESS` | caddy | `http://console.localhost:8080`; staging — завжди `http://console.localhost:8080`; production — обов'язкова | Адреса сайту консолі для Caddy (`console.example.ua` → HTTPS автоматично) |
| `CONSOLE_ALLOWED_IPS` | caddy | усі (`0.0.0.0/0 ::/0`) | IP або мережі (CIDR, через пробіл), з яких відкривається консоль; решта отримує 404 |
| `SITE_URL` | web, **console** (збірка й середовище) | як і раніше | У консолі — основа абсолютних посилань на вітрину |
| `API_INTERNAL_URL` | web, console | `http://api:8080` у compose | Як і раніше; у консолі потрібна лише для `next dev` |

На staging (доступ через SSH-тунель на `localhost:8081`) консоль відкривається як http://console.localhost:8081.

### 12.4. CSS після розділення

Кожен маніфест містить лише сегменти, правила яких можуть зачепити елементи цього застосунку, у старому порядку
(розділ 6.1). Щоб жоден сегмент не змішував правила для різних застосунків, п'ять сегментів розрізано на суцільні
частини (порядок правил не змінився):

| Сегмент | Частини |
| --- | --- |
| `layout/styles/header.css` | `header.css` (`.site-header`, `.site-header__bar`) → `pkg/styles/ui/logo.css` (`.logo`, логотип консолі) → `header-menu.css` |
| `product/styles/product.css` | `product.css` → `pkg/styles/ui/buybox-meta.css` (`.buybox__meta`, ним користуються списки `dl.buybox__meta` консолі) → `product-info.css` |
| `shared/styles/ui/lines.css` | `shop/shared/styles/ui/lines.css` → `pkg/styles/ui/remove.css` (`.remove`, кнопка «Спробувати ще раз» у `StateBox` консолі) → `shop/shared/styles/ui/totals.css` |
| `shared/styles/admin/controls.css` | `console/shared/styles/controls.css` → `pkg/styles/ui/seg-compact.css` (`.seg` з кнопками) |
| `shared/styles/admin/cards.css` | `console/shared/styles/cards.css` → `pkg/styles/ui/meta-list.css` (`dl.buybox__meta`) → `console/shared/styles/console-meta.css` |

Що з'ясувалося під час розбору:

- **Консоль спиралася на правила вітрини:** `.logo`, кнопки, `.field`/форми, `.notice`, `.check`, `.seg`, `.pager`,
  хлібні крихти, скелетони, `.prose`, `.remove`, `.buybox__meta`, а також `body`/`main`/`.muted`/`.code` з
  `layout.css` і `tokens.css`/`base.css`. Усе це тепер у пакеті. `ui/page-head.css` теж у пакеті: його використовує
  сторінка 404 консолі.
- **Вітрина спиралася на правила консолі.** Неізольовані `.seg { … }` і `.seg button …` з `controls.css`
  перекривали `.seg` вітрини (сортування в лістингу, способи доставки й оплати), а `dl.buybox__meta` з `cards.css`
  задавав сітку блоку реквізитів на сторінці замовлення `/order/[number]`. Ці правила тепер у пакеті
  (`seg-compact.css`, `meta-list.css`) і стоять наприкінці маніфесту вітрини — там само, де були. У `seg-compact.css`
  лишилися змінні `--a-ctl-sm` і `--a-bg`, яких на вітрині немає: так було й до розділення, вигляд вітрини той самий.
- **Друк вітрини.** `@media print` з `orders/styles/print.css` (друк накладної) ховав на вітрині хлібні крихти й робив
  посилання чорними без підкреслення. Щоб друк сторінок вітрини не змінився, вітрина має власний
  `src/shared/styles/print.css` з цими двома правилами (`.crumbs`, `a`) в кінці маніфесту; у `css-cascade.mjs` вони
  дають ті самі рядки, що й раніше.
- **Не потрапили в консоль два правила медіаблоків вітрини, що формально збігаються з елементами консолі:**
  `@media (max-width: 60rem) .logo { height; font-size }` (`responsive/site.css`) і
  `@media (max-width: 40rem) .fields-2, … { grid-template-columns }` (`responsive/shop.css`). У консолі обидва
  властивості завжди перекриваються специфічнішими `.console-side__brand .logo`, `.console-login__card .logo` і
  `.console-form .fields-2` (`.fields-2` є лише у формі товару), тож розрізати медіаблоки не довелося. Мобільні знімки
  входу й редактора товару це підтверджують (0 % різниці).

### 12.5. Що ще змінилося

- **`<head>` консолі.** Кореневий макет консолі не має GA4 (`GoogleAnalytics`), `google-site-verification` і опису
  вітрини (`description`), які раніше успадковувалися від спільного кореневого макета; лишилися `title`
  (`%s | Консоль Poli Valko`), `robots: noindex, nofollow`, `themeColor`, шрифт і `preconnect` до Unsplash (фото на
  сторінці входу). Тіло сторінок те саме (`skip-link`, `div.console`, …).
- **Папки фіч без рівня області** (`features/<фіча>`, без проміжної теки застосунку), ключі `edges` — так само.
- **`api:types`** належить пакету (`npm run api:types -w @polivalko/shared`, кореневий скрипт його викликає); схема
  перегенерована з поточного `openapi/polivalko-api.json` (додалися лише нові шляхи `/api/v1/account/...`).
- **`typecheck`** — новий скрипт: `next typegen && tsc --noEmit` у застосунках (типи `LayoutProps`/`PageProps`
  генеруються без повної збірки), `tsc --noEmit` у пакеті. CI запускає його між `lint` і `build`.

### 12.6. Перевірка (на момент розділення; адреси, назви й команди — тодішні)

- `npm run typecheck`, `npm run lint`, `npm run build` — без помилок і попереджень у всіх трьох workspace-ах;
  `npm run api:types` відтворює закомічений `schema.d.ts`.
- Каскад: розділ 6.3 (767 / 719 правил — підпослідовності базових 1300; зібраний CSS — підпослідовності базового).
- Docker: `docker compose --profile app build web admin`, `up -d --no-deps web admin caddy`: http://localhost:8080/
  → 200; http://admin.localhost:8080/login → 200 з `X-Robots-Tag: noindex, nofollow` і заголовками безпеки;
  http://localhost:8080/admin/orders → 308 на http://admin.localhost:8080/orders (`/admin` → `/`, query зберігається,
  `/administrator` — 404 вітрини); на хості консолі `/internal/*` → 404, `/health/live` → 200, `/api/...` → API.
  Вхід на http://admin.localhost:8080/login ставить `pv_admin` на `admin.localhost`; без сесії `/orders` веде на
  `/login?next=%2Forders`, після входу — назад; `next=//…`, `/\…`, `https://…` ведуть на `/`.
- Знімки (86 сторінок, 1440 і 375 px) проти базових 3370b40: вітрина — розбіжності лише відомого шуму
  (порядок `<title>`/`next-route-announcer`, `id` з `useId` на пошуку, декодування фото на послугах); консоль — після
  зведення шляхів палітри (`/admin/x` → `/x`) лише відомий шум (час оновлення цін, прогони Worker, час друку).

## 13. Особистий кабінет покупця (2026-11-04)

Кабінет — додаток до гостьової покупки, а не її заміна: оформлення без входу працює й рендериться так само, як раніше.
API кабінету — `/api/v1/account/*` (опис — `docs/architecture-backend.md`), cookie сесії `pv_customer`.

### 13.1. Маршрути

Усі маршрути кабінету лежать у `src/app/(shop)/account/` (хром вітрини той самий), мають
`robots: { index: false, follow: false }` у `metadata`, а `/account` додано в `disallow` файлу `robots.ts`
(звідти ж прибрано шлях колишньої панелі працівників: вітрина ніде не згадує консоль).

| Шлях | Екран | Примітка |
| --- | --- | --- |
| `/account/login` | `LoginScreen` | `?next=` (лише локальний шлях, `safeNext`), `?reason=favorites` — пояснення про обране |
| `/account/register` | `RegisterScreen` | той самий `next`; після реєстрації — повідомлення про лист підтвердження й кнопка далі |
| `/account/forgot-password` | `ForgotPasswordScreen` | відповідь завжди однакова, щоб не розкривати, чи є такий email |
| `/account/reset-password?token=` | `ResetPasswordScreen` | ціль посилання з листа; після зміни пароля локальна сесія скидається |
| `/account/confirm-email?token=` | `ConfirmEmailScreen` | ціль посилання з листа; підтверджує один раз і оновлює сесію |
| `/account`, `/account/orders` | `OrdersScreen` | у `(cabinet)/layout.tsx` — `AccountShell`; сторінки `?page=` |
| `/account/orders/[number]` | `OrderDetailScreen` | `?payment=return` — повернення від платіжної системи |
| `/account/favorites` | `FavoritesScreen` | плитки `ProductTiles` з сердечками |
| `/account/addresses` | `AddressesScreen` | до 10 адрес: відділення НП або кур'єр |
| `/account/profile` | `ProfileScreen` | ім'я й телефон, зміна пароля |

Файли маршрутів тонкі (метадані й один екран). Екрани з `useSearchParams`/`useParams` загорнуті в `Suspense`
усередині фічі, тож сторінки лишаються ◐ (статична оболонка + клієнтські дані), як `/checkout`.

### 13.2. Фічі

- **`customer`** (лише від `shared`) — нижній шар кабінету:
  - `lib/session-store.ts` — модульне сховище сесії для `useSyncExternalStore` (`unknown` → `guest` | `signedIn`, `me`).
    Підказка `pv-customer` у `localStorage` ставиться після входу чи реєстрації й знімається після виходу або
    відповіді 401. Без підказки сесія одразу `guest` і `/me` не викликається: гість не робить жодного запиту до
    `/api/v1/account/*`. З підказкою `GET /me` виконується один раз на завантаження сторінки (спільний проміс для
    шапки, сердечок, оформлення й кабінету). `expireOn401` переводить сесію в `guest` на будь-якій відповіді 401.
  - `lib/csrf.ts` — власна копія CSRF вітрини (консоль має свою): токен з `GET /api/v1/account/csrf` кешується
    промісом, `withCsrf` додає `X-CSRF-TOKEN` до кожного не-GET виклику й один раз повторює запит після
    `auth.csrf_invalid`. Токен забувається після входу, реєстрації, виходу й скидання пароля (він прив'язаний до
    користувача).
  - `lib/session-actions.ts` — `signIn`, `signUp`, `signOut`, `sessionEnded`; `AccountButton` — іконка «Особистий
    кабінет» у шапці між пошуком і кошиком (посилання на `/account`; для покупця, що увійшов, — зелена крапка).
  - `getAddresses`/`postAddress`, `addressTitle`/`addressPlace` — потрібні і кабінету, і оформленню.
- **`favorites`** (від `customer`) — `lib/favorites-store.ts`: множина id з `GET /favorites/ids`, прив'язана до id
  покупця (зміна покупця — перезавантаження, вихід — очищення). Перемикання оптимістичне з відкатом у разі помилки
  (наприклад, `catalog.favorites_limit`). `FavoriteButton` — кнопка з `aria-pressed` і підписом «Додати в обране» /
  «Прибрати з обраного» (у плитці з назвою товару, як інші кнопки плитки); гостя веде на
  `/account/login?next=<поточна сторінка>&reason=favorites`. Сердечко стоїть у наявній зоні дій плитки
  (`.tile__bar` між «Переглянути» і «У кошик», `.tile__actions` у лукбук-плитках) і поруч із кнопкою «Купити» на
  сторінці товару — кути фото лишаються для стрічок знижки й акції.
- **`account`** (від `customer`, `favorites`, `catalog`, `cart`, `checkout`, `order`, `payment`) — усі екрани з
  розділу 13.1. Дані кабінету тягне клієнт (`useAccountData`: ключ, `reload`, 404, 401 → вихід). `CabinetFrame`
  показує скелет, доки сесія невідома, і веде гостя на `/account/login?next=…`. Навігація: бічне меню на десктопі,
  вкладки на мобільному; банер «Підтвердьте email» з «Надіслати лист ще раз», поки email не підтверджено.

### 13.3. Зміни в наявних фічах

Усі зміни додають необов'язкові пропси чи експорти; гостьові сторінки рендеряться так само.

- `checkout`: стан міста й відділення винесено в `hooks/use-delivery-point.ts` (той самий код, плюс захист від
  гонки запитів відділень і необов'язкова початкова точка для форми адреси). `hooks/use-checkout-account.ts` для
  покупця, що увійшов: заповнює порожні ім'я, телефон і email з профілю (лише значення DOM, розмітка та сама),
  показує «Мої адреси» (основна обрана одразу), а для нової адреси — прапорець «Зберегти адресу в кабінеті», що
  зберігає її після успішного замовлення. `CheckoutDelivery` отримав слоти `saved`/`save` і `courier` (ключ і
  значення для повторного монтування полів кур'єра), `CheckoutCourierFields` — `defaults`, `SettlementPicker`
  оновлює текст, коли значення змінилося ззовні. Для гостя слоти порожні, а `POST /api/v1/orders` той самий.
- `order`: `dl` з фактами винесено в `OrderFacts` (`OrderHead` рендерить його без змін), `OrderHistory` має
  необов'язковий `back`; новий `index.ts` експортує ці чисті компоненти для кабінету.
- `payment`: `PayButton` приймає необов'язковий `start` (кабінет платить через
  `POST /api/v1/account/orders/{number}/payments` з CSRF), `PaymentPending` — `onRefresh` (кабінет перечитує дані
  клієнтом замість `router.refresh()`).
- `cart`: `BuyForm` має слот `aside` в кінці блоку дій (сердечко на сторінці товару).
- `layout`: `AccountButton` у `site-header__actions`.

### 13.4. CSS

Нові сегменти стоять у маніфесті вітрини одразу після `content/styles/credits.css` і перед трьома останніми рядками
(`seg-compact.css`, `meta-list.css`, `print.css`): `customer/styles/account-button.css`,
`favorites/styles/favorites.css`, `checkout/styles/saved-addresses.css`, `account/styles/auth.css`, `cabinet.css`,
`orders.css`, `addresses.css`, `profile.css` (маніфест — 68 рядків). Кожне правило спирається на новий клас (наявні
класи — лише як контекст, наприклад `.tile__bar .fav-toggle`), медіаблоки — у кінці свого сегмента; кольори, шрифт і
відступи — наявні токени.

### 13.5. Повторне замовлення й оплата з кабінету

«Повторити замовлення» звіряє склад замовлення з `POST /api/v1/checkout/quote` і через `useCart().add` кладе в
кошик лише наявні товари (кількість — не більше залишку, ціна й фото — актуальні з розрахунку). Що не вдалося
додати чи додано меншою кількістю, перелічує повідомлення під кнопкою. «Оплатити» (`canPay`) — `PayButton` зі своїм
`start`; платіжна система повертає на `/account/orders/{number}?payment=return`, де `PaymentPending` до 10 разів
перечитує замовлення, а після оплати показує «Оплату отримано».

### 13.6. Перевірка

- `npm run typecheck`, `npm run lint`, `npm run build` — без помилок і попереджень у всіх трьох workspace-ах. Таблиця
  маршрутів наявних сторінок не змінилася; нові `/account/**` — ◐.
- E2E (puppeteer, зібраний образ `web`): гість на сердечку → вхід з `next` і поясненням; реєстрація з помилками полів,
  потім успіх і повідомлення про лист; банер і повторний лист; посилання підтвердження з журналу API; вихід, хибний
  пароль, вхід; сердечко в плитці й на сторінці товару → обране, зняття сердечка; адреси (відділення, кур'єр,
  основна, зміна, видалення); профіль і зміна пароля; відновлення пароля за посиланням з журналу; замовлення з
  кабінету (контакти заповнені, основна адреса обрана, інша адреса збережена прапорцем) → список і деталі,
  повторення в кошик, оплата тестовою платіжною сторінкою; гість без жодного запиту до `/api/v1/account/*` і
  гостьове оформлення. Усі сторінки кабінету на 375 px — без горизонтальної прокрутки.
- Знімки 86 сторінок проти стану після розділення: на вітрині DOM відрізняється лише іконкою кабінету в шапці й
  сердечками (у плитках і на сторінці товару) плюс відомий шум (`id` з `useId` на пошуку, друге фото слайдера на
  головній через таймер 2,5 с, недекодоване фото розділу); консоль — лише дані, що додали тестові замовлення
  (лічильники, KPI, списки замовлень і покупців) і час прогонів Worker.

## 14. Консоль (перейменування, 2026-11-04)

Панель працівників називається «консоль» — у коді, адресах, інтерфейсі й документації; вітрина її, як і раніше, не
згадує. Лишилися назви, що походять від ролі «адміністратор» з ТЗ: роль `Admin`, політика `admin`, охоронці
`AdminOnly` / `AdminOnlyNotice` і їхні повідомлення, `Seed:Users[].Role`, `ADMIN_EMAIL` / `ADMIN_PASSWORD` (перший
адміністратор). Розмітка (крім імен класів і підписів із назвою панелі), каскад CSS, таблиці маршрутів `next build`,
запити й поведінка не змінилися.

| Було | Стало |
| --- | --- |
| `web/apps/admin`, workspace `admin` (`-w admin`), `APP=admin` | `web/apps/console`, workspace `console` (`-w console`), `APP=console` |
| група маршрутів `src/app/(admin)`, кореневий `div.admin` | `src/app/(console)`, `div.console` |
| класи `.admin`, `.admin-*`; `admin-meta.css`, `responsive/admin.css`, `responsive/admin-screens.css` | `.console`, `.console-*`; `console-meta.css`, `responsive/console.css`, `responsive/console-screens.css` |
| `AdminShell` (`admin-shell.tsx`), `useAdminData`, `useAdminForm` (`use-admin-*.ts`), подія `admin:search` | `ConsoleShell` (`console-shell.tsx`), `useConsoleData`, `useConsoleForm` (`use-console-*.ts`), `console:search` |
| `AdminOrder`, `AdminCategory`, `AdminCollection`; схеми OpenAPI `Admin*Dto` | `ConsoleOrder`, `ConsoleCategory`, `ConsoleCollection`; `Console*Dto` |
| API `/api/v1/admin/*`, тег `Admin`, `operationId` `Admin*`, cookie `pv_admin` | `/api/v1/console/*`, `Console`, `Console*`, `pv_console` |
| модуль `PoliValko.Admin`, теки `Features/Admin`, `MapAdmin…Endpoints` | `PoliValko.Console`, `Features/Console`, `MapConsole…Endpoints` (`docs/architecture-backend.md`) |
| сервіс compose `admin`, образи `polivalko-admin`, `polivalko-staging-admin` | `console`, `polivalko-console`, `polivalko-staging-console` |
| `ADMIN_ADDRESS`, `ADMIN_ALLOWED_IPS`; локально `http://c4x9v2.localhost:8080` | `CONSOLE_ADDRESS`, `CONSOLE_ALLOWED_IPS`; `http://console.localhost:8080` |
| `%s \| Адмінка Poli Valko`, «Адмінка», «Розділи адмінки», «Пошук по адмінці», «Доступ до адмінки» | `%s \| Консоль Poli Valko`, «Консоль», «Розділи консолі», «Пошук по консолі», «Доступ до консолі» |

Після оновлення працівники входять знову (cookie має нове ім'я); старі адреси панелі й `/api/v1/admin/*` відповідають
404. Рядок `Запит з адмінки` у прогонах синхронізацій лишився: це збережене значення (`sync_runs.started_by`,
`docs/architecture-backend.md`, розділ 6.3).

Перевірка:

- `dotnet build` без попереджень, 191 тест, `has-pending-model-changes` — без змін. Документ OpenAPI після заміни
  `admin` → `console` у попередній версії збігається з новим структурно (94 шляхи в тому самому порядку, 150 схем);
  порядок схем змінився лише через нові імена. Інтеграційні тести тепер виконуються в іншому порядку класів, тож
  `ApiFactory.ProcessOutboxAsync` обробляє outbox до спорожнення, а не одну пачку з 20 повідомлень.
- `npm run typecheck`, `lint`, `build` — чисто; `npm run api:types` відтворює `schema.d.ts`; таблиці маршрутів ті самі.
  Вивід `css-cascade.mjs` консолі (719 правил) після зворотної заміни `console` → `admin` збігається з попереднім
  побайтно, вітрини (767 правил) — без змін; так само всі 249 файлів `apps/console`, пакета й конфігурації.
- Docker: http://localhost:8080/ → 200; http://console.localhost:8080/login → 200 з `X-Robots-Tag: noindex, nofollow`;
  вхід ставить HttpOnly-cookie `pv_console` на `console.localhost`; на домені магазину `/api/v1/console/*` → 404 від
  Caddy, `/admin` — сторінка 404 вітрини, `/api/v1/admin/*` → 404 на обох хостах; з `CONSOLE_ALLOWED_IPS=203.0.113.10`
  консоль → 404, вітрина → 200.
- Знімки 86 сторінок (1440 і 375 px) проти стану перед перейменуванням: вітрина — 31 з 36 без змін, решта — відомий
  шум (друге фото слайдера на головній, порядок `<title>`/`next-route-announcer`, `id` з `useId` на пошуку,
  декодування фото на послугах). Консоль після зворотної заміни класів і підписів: 2 сторінки без змін, 33
  відрізняються лише числами й датами (лічильники меню, сповіщення, час прогонів), 15 — даними двох нових замовлень
  (списки, KPI, графік, картка замовлення); жодного іншого рядка. Смоук-тест консолі (усі 20 маршрутів, палітра, дзвоник,
  масова й поштучна зміна статусу, CSV через `/api/v1/console/orders/export`) — без помилок; на 375 px жодна сторінка
  вітрини й консолі не ширша за екран.
