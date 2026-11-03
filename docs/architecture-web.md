# Архітектура клієнта (web/)

Документ описує цільову будову Next.js-клієнта PoliValko: вітрини й адмінки. Мета рефакторингу — фічеве розбиття
з явними межами без жодної зміни поведінки: той самий HTTP API, ті самі маршрути, розмітка, класи, тексти, стилі,
метадані й поведінка в браузері.

Версії: Next.js 16 (App Router, `cacheComponents`, `partialPrefetching`), React 19, TypeScript, ESLint 9 (flat config).
Перед зміною коду читайте відповідні розділи `web/node_modules/next/dist/docs/` (див. `web/AGENTS.md`).

## 1. Принципи

1. **Маршрути тонкі.** Файли в `src/app` потрібні лише маршрутизатору: вони тримають `metadata` / `generateMetadata`,
   конфігурацію сегмента (`instant`, тощо), `Suspense`, якщо він є частиною маршруту, і складають екран із публічного
   API фіч. Бізнес-розмітки, запитів і станів у них немає.
2. **Фіча володіє всім своїм:** компонентами, хуками, доступом до даних (серверні функції з `"use cache"` і клієнтські
   виклики `browserApi`), чистою логікою й стилями.
3. **Публічний API фічі — лише `index.ts` і `server.ts`.** Усе інше всередині фічі приватне.
4. **`shared` — нижній шар.** Він не знає про фічі й маршрути.
5. **Межа «клієнт/сервер» мінімальна.** `"use client"` стоїть лише на модулях, які використовують стан, ефекти,
   контекст, обробники подій або API браузера. Серверний код (внутрішня адреса API, `"use cache"`-функції) позначений
   `import "server-only"` і не може потрапити в клієнтський бандл.
6. **Каскад CSS незмінний.** Стилі розкладено по фічах, але порядок правил у підсумковому CSS той самий.

## 2. Шари й напрям залежностей

```
app (маршрути)  ──►  features/<область>/<фіча> (index.ts | server.ts)  ──►  shared
                         │
                         └──► інші фічі лише через їхній index.ts / server.ts
```

| Шар | Може імпортувати | Не може імпортувати |
| --- | --- | --- |
| `src/app/**` | `@/features/<область>/<фіча>`, `@/features/<область>/<фіча>/server`, `next/*`, `react`, `./globals.css` | `@/shared/**`, будь-які внутрішні файли фіч, сусідні `.ts/.tsx` |
| `src/features/<область>/<фіча>/**` | власні файли відносними шляхами, `@/shared/**`, публічний API інших фіч | внутрішні файли інших фіч, відносні шляхи за межі своєї фічі, `@/app/**` |
| `src/shared/**` | `@/shared/**`, сторонні пакети | `@/features/**`, `@/app/**` |

Додатково для всіх файлів: заборонені старі шляхи `@/lib/**` і `@/components/**`.

Циклічних залежностей між фічами немає. Дозволені ребра (фіча → від чого залежить):

- Вітрина: `cart → analytics`; `catalog → cart`; `product → catalog, cart, analytics`; `home → catalog, services, content`;
  `layout → cart, catalog, services, content, search`; `search → catalog`; `checkout → cart, analytics`;
  `order → payment, analytics`; `services`, `content`, `payment`, `analytics` — лише від `shared`.
- Адмінка: `shell → auth`; `dashboard → shell, orders, catalog`; `orders → shell`; `catalog → auth`;
  `content → auth`; `integration → auth`; `staff → auth`; `audit → auth`; `requests → shell`; `customers`, `auth` — лише
  від `shared`.

Цей список — мапа `edges` у `web/eslint.config.mjs`: імпорт фічі, якої немає серед залежностей (зокрема власного
публічного API зсередини фічі чи фічі іншої області), — помилка `npm run lint` (розділ 7).

## 3. Цільове дерево

```
web/src/
├─ app/                                   маршрути (тонкі)
│  ├─ layout.tsx  globals.css  not-found.tsx  robots.ts  sitemap.ts  favicon.ico
│  ├─ internal/revalidate/route.ts
│  ├─ pay/layout.tsx  pay/sandbox/[id]/page.tsx
│  ├─ (shop)/layout.tsx  error.tsx  page.tsx  cart/ catalog/ catalog/[slug]/ checkout/ contacts/ credits/
│  │        offer/ order/[number]/ payment-delivery/ privacy/ product/[slug]/ returns/ search/ services/
│  └─ admin/layout.tsx  login/page.tsx
│     └─ (panel)/layout.tsx  page.tsx  audit/ catalog/(categories|collections|import|redirects|products/[id])/
│                 content/(layout.tsx|contacts|pages/[slug]|pickup|services)/ customers/ integration/
│                 orders/ orders/[number]/ requests/ staff/
├─ features/
│  ├─ shop/
│  │  ├─ analytics/   GA4: track, TrackPurchase, TrackViewItem, GoogleAnalytics
│  │  ├─ cart/        сховище кошика (localStorage), CartProvider/useCart, useCartQuote, CartButton, CartDrawer,
│  │  │               CartScreen/CartView, BuyForm, AddToCart
│  │  ├─ catalog/     дерево розділів, пошук товарів, плитки товарів і розділів, лістинг з фільтрами й пейджером,
│  │  │               CatalogScreen, CategoryScreen, перенаправлення старих URL, sitemap-дані
│  │  ├─ product/     ProductScreen: галерея, блок покупки, варіанти, опис і характеристики, схожі товари, JSON-LD
│  │  ├─ home/        HomeScreen: слайдер, лукбук-секції, стрічки (Rail), переваги, кроки, магазин у Бучі
│  │  ├─ layout/      хром вітрини: ShopShell, SiteHeader (меню, мегаменю, мобільне меню), SiteFooter, BackToTop
│  │  ├─ search/      SearchButton (панель пошуку в шапці), SearchScreen
│  │  ├─ checkout/    CheckoutScreen: форма, вибір міста й відділення НП, підсумок, створення замовлення
│  │  ├─ order/       OrderScreen: сторінка результату замовлення, чеки, історія
│  │  ├─ payment/     PayButton, PaymentPending, SandboxPaymentScreen
│  │  ├─ services/    ServicesScreen, ServiceRequestForm, напрямки послуг
│  │  └─ content/     InfoPage, PageHead, ContactsScreen, CreditsScreen, OfferScreen (реквізити продавця)
│  └─ admin/
│     ├─ auth/        StaffGate, useStaff, AdminOnly, LoginScreen, вихід
│     ├─ shell/       AdminShell, useSummary, бічна панель, верхня смуга, сповіщення, палітра Ctrl+K
│     ├─ dashboard/   OverviewScreen, графік виручки, KPI, черга, стан інтеграцій
│     ├─ orders/      OrdersScreen, OrderDetailScreen, OrdersTable, StatusText, PaymentStatusText, повернення, оплати й чеки
│     ├─ customers/   CustomersScreen
│     ├─ requests/    RequestsScreen
│     ├─ catalog/     ProductsScreen, ProductEditorScreen, CategoriesScreen, CollectionsScreen, RedirectsScreen,
│     │               ImportScreen, CatalogTabs, StockText
│     ├─ content/     ContentSectionLayout, ContentPagesScreen, PageEditorScreen, ContactsEditorScreen,
│     │               PickupEditorScreen, ServicesEditorScreen
│     ├─ integration/ IntegrationScreen (завдання, прогони, черга, Нова пошта)
│     ├─ staff/       StaffScreen і форми працівників
│     └─ audit/       AuditScreen
└─ shared/
   ├─ api/      browser.ts (browserApi, newIdempotencyKey), server.ts (api, server-only), types.ts (псевдоніми DTO),
   │            problem.ts (Problem і хелпери Problem Details), schema.d.ts (ГЕНЕРУЄТЬСЯ, не редагувати)
   ├─ lib/      format.ts, images.ts, labels.ts, stand-in-photos.ts, quantity.ts (MAX_QUANTITY)
   ├─ hooks/    use-hydrated.ts
   ├─ ui/       icons.tsx, quantity-stepper.tsx
   ├─ admin/    csrf.ts (csrfHeader, forgetCsrf, withCsrf), use-admin-data.ts, format.ts (when), download.ts
   │  ├─ ui/    state-box.tsx, page-head.tsx, modal.tsx, pager.tsx, selection.tsx (useSelection, CheckAll)
   │  └─ form/  field.tsx, check-field.tsx, field-error.tsx, form-status.tsx, save-button.tsx, use-admin-form.ts
   └─ styles/   tokens.css, base.css, layout.css
      ├─ ui/         buttons, stepper, fill, crumbs, states, page-head, check, seg, pager, lines, summary-layout,
      │              forms, notice, prose (.css)
      ├─ admin/      root, page-head, controls, filters, cards, tables, pager, tabs, notices, grids, actions, forms,
      │              modal (.css)
      └─ responsive/ site, shop, admin, admin-screens (.css)
```

Власні `styles/` мають 15 фіч: вітрина — `layout`, `search`, `home`, `catalog`, `product`, `content`, `cart`, `order`,
`checkout`, `services`, `payment`; адмінка — `shell`, `auth`, `dashboard`, `orders`. Перелік файлів — розділ 6.2.

### 3.1. Будова фічі

```
features/<область>/<фіча>/
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
  (`api/server.ts`, `@/shared/api/server`) — інакше клієнтський компонент іншої фічі втягне серверний код у бандл
  і збірка впаде. Усе таке йде через `server.ts`.
- Клієнтські файли імпортують інші фічі лише через `index.ts`.
- Фіча має `index.ts`, `server.ts` або обидва, і експортує лише те, що справді імпортують маршрути чи інші фічі.
  Порожніх `index.ts` і «про запас» реекспортів немає: внутрішні компоненти, хелпери й типи лишаються приватними.

### 3.2. Публічний API фіч

Фактичний вміст `index.ts` і `server.ts` (усе інше в фічі приватне).

| Фіча | `index.ts` | `server.ts` |
| --- | --- | --- |
| `shop/analytics` | `track`, `TrackPurchase`, `TrackViewItem`, `GoogleAnalytics` | — |
| `shop/cart` | `CartProvider`, `useCart`, `useCartQuote`, `CartButton`, `CartDrawer`, `CartScreen`, `BuyForm`, `AddToCart` | — |
| `shop/catalog` | `ProductTile`, `ProductTiles`, `ProductTilesSkeleton`, `CategoryTile`, `CategoryGrid`, `ListingSkeleton`, `discountPercent`, тип `SearchParams` | `getCategory`, `getCategoryTree`, `getCollections`, `getSitemap`, `resolveRedirect`, `searchProducts`, `CatalogListing`, `CatalogScreen`, `CategoryScreen` |
| `shop/product` | `descriptionText` | `getProduct`, `ProductScreen` |
| `shop/home` | — | `HomeScreen` |
| `shop/layout` | — | `ShopShell` |
| `shop/search` | `SearchButton` | `SearchScreen` |
| `shop/checkout` | `CheckoutScreen` | — |
| `shop/order` | — | `OrderScreen` |
| `shop/payment` | `PayButton`, `PaymentPending`, `SandboxPaymentScreen` | — |
| `shop/services` | — | `getServiceDirections`, `ServicesScreen` |
| `shop/content` | — | `getContacts`, `InfoPage`, `ContactsScreen`, `CreditsScreen`, `OfferScreen` |
| `admin/auth` | `StaffGate`, `useStaff`, `AdminOnly`, `LoginScreen`, `logout` | — |
| `admin/shell` | `AdminShell`, `useSummary` | — |
| `admin/dashboard` | `OverviewScreen` | — |
| `admin/orders` | `OrdersScreen`, `OrderDetailScreen`, `OrdersTable`, `StatusText` | — |
| `admin/customers` | `CustomersScreen` | — |
| `admin/requests` | `RequestsScreen` | — |
| `admin/catalog` | `ProductsScreen`, `ProductEditorScreen`, `CategoriesScreen`, `CollectionsScreen`, `RedirectsScreen`, `ImportScreen`, `StockText` | — |
| `admin/content` | `ContentSectionLayout`, `ContentPagesScreen`, `PageEditorScreen`, `ContactsEditorScreen`, `PickupEditorScreen`, `ServicesEditorScreen` | — |
| `admin/integration` | `IntegrationScreen` | — |
| `admin/staff` | `StaffScreen` | — |
| `admin/audit` | `AuditScreen` | — |

## 4. Конвенції

- **Файли:** kebab-case (`checkout-form.tsx`, `use-cart-quote.ts`). Компоненти й типи — PascalCase, хуки — `useX`.
- **Екрани:** тіло сторінки, яке маршрут рендерить цілком, має суфікс `Screen` (`OrderDetailScreen`, `HomeScreen`).
  Екран вітрини з запитами — серверний (експорт із `server.ts`); екран адмінки — клієнтський (експорт з `index.ts`).
- **Розмір:** компонентний файл — до ~150 рядків, жоден `.ts/.tsx` не довший за 200 рядків, крім
  `shared/api/schema.d.ts` і `shared/ui/icons.tsx`. Маршрутний файл — до 40 рядків
  (з `generateMetadata` — до 60).
- **`"use client"`** — першим рядком лише там, де є хуки, контекст, обробники подій чи API браузера. Чисті хелпери,
  константи й `api/client.ts` директиви не мають: вони стають клієнтськими, коли їх імпортує клієнтський модуль.
- **Сервер:** `shared/api/server.ts` і кожен `features/*/*/api/server.ts` починаються з `import "server-only";`
  (Next.js обробляє цей імпорт сам, пакет ставити не треба). Функції з `"use cache"` зберігають ті самі `cacheLife`
  і `cacheTag`: теги скидає `/internal/revalidate`.
- **Дані в адмінці:** компонент викликає `useAdminData(key, () => getOrder(number))`; самі запити живуть в
  `api/client.ts` фічі. Змінні запити — через `withCsrf` з `@/shared/admin/csrf` (один модуль — один кешований токен).
- **Контексти** (`CartContext`, `StaffContext`, `SummaryContext`) і модульний стан (кошик у `localStorage`, CSRF-токен)
  створюються рівно в одному модулі.
- **Коментарі** в коді не пишемо.

## 5. Інваріанти рефакторингу

1. Розмітка, класи, тексти, атрибути, `key` і порядок елементів — ті самі. Те саме стосується масивів, фрагментів і
   кількості сусідів на шляху до компонентів з `useId` (`FiltersPanel`, `SettlementPicker`, `Modal`): від цього
   залежать згенеровані `id` (на сторінці пошуку в знімку видно `#_R_…`).
2. Межі `Suspense`, виклики `connection()`, `"use cache"`, `cacheLife`, `cacheTag`, `cache: "no-store"` — без змін.
3. `metadata`, `generateMetadata`, `viewport`, конфігурація сегментів (`instant = false`) лишаються у файлах маршрутів.
4. Таблиця маршрутів `next build` (○ / ◐ / ƒ для кожного шляху) не змінюється.
5. Запити до API ті самі: шляхи, параметри, заголовки (`Idempotency-Key`, `X-CSRF-TOKEN`), тіла, повтор після
   `auth.csrf_invalid`.
6. Нових залежностей npm немає. `schema.d.ts` лише генерується (`npm run api:types`).

## 6. CSS

### 6.1. Як влаштовано

Усі стилі глобальні й підключаються **одним** імпортом `import "./globals.css"` у `app/layout.tsx`. Next.js не
гарантує порядок CSS, імпортованого з різних компонентів, тож компоненти CSS не імпортують.
`app/globals.css` — маніфест: лише `@import url("…");` відносними шляхами до сегментів у `shared/styles/**` і
`features/*/*/styles/**` **у порядку, в якому правила йшли у вихідних файлах**. Вкладених `@import` у сегментах немає.

Сегмент — суцільний шматок вихідного файлу. Правило розбиття: сегмент, яким користується одна фіча, лежить у цій
фічі; яким користуються кілька — у `shared/styles/ui` (вітрина) або `shared/styles/admin` (адмінка). Медіаблоки в
кінці вихідних файлів змішують правила різних фіч, тож вони лишаються цілими в `shared/styles/responsive/*`:
інакше змінився б відносний порядок правил.

Зараз `globals.css` — 75 рядків `@import url("…");` (2 + 14 + 35 + 14 + 10 сегментів) у порядку таблиць
розділу 6.2, шляхи відносно `src/app`. Початок файлу:

```css
@import url("../shared/styles/tokens.css");
@import url("../shared/styles/base.css");
@import url("../shared/styles/layout.css");
@import url("../features/shop/layout/styles/header.css");
```

Новий сегмент додається окремим файлом у `styles/` фічі (або в `shared/styles/**`, якщо ним користуються кілька фіч)
і рядком `@import` у `globals.css` там, де його правила мають стояти в каскаді. Сегменти не містять `@import`
і коментарів, `@media`/`@starting-style`-блоки не розрізаються, `@keyframes` лежать поруч зі своїм сегментом.

### 6.2. Карта сегментів

Номери рядків — за `git show 583c573:web/src/app/<файл>` (межі припадають на порожні рядки або коментарі).
Порядок у таблицях — порядок `@import` у `globals.css`.

`tokens.css` → `shared/styles/tokens.css`, `base.css` → `shared/styles/base.css`.

`site.css`:

| Рядки | Вміст | Файл |
| --- | --- | --- |
| 1–11 | body, main, skip-link, .code, .muted | `shared/styles/layout.css` |
| 12–44 | шапка, меню, підменю, мегаменю | `features/shop/layout/styles/header.css` |
| 45–53 | дії шапки, .icon-btn, лічильник кошика | `features/shop/layout/styles/header-actions.css` |
| 54–64 | панель пошуку | `features/shop/search/styles/search-panel.css` |
| 65–78 | мобільне меню | `features/shop/layout/styles/mobile-menu.css` |
| 79–85 | кнопка «вгору» | `features/shop/layout/styles/back-to-top.css` |
| 86–106 | кнопки, .link | `shared/styles/ui/buttons.css` |
| 107–117 | лічильник кількості | `shared/styles/ui/stepper.css` |
| 118–130 | .section, .band--grey, .heading | `features/shop/home/styles/sections.css` |
| 131–133 | .fill | `shared/styles/ui/fill.css` |
| 134–155 | футер | `features/shop/layout/styles/footer.css` |
| 156–162 | хлібні крихти | `shared/styles/ui/crumbs.css` |
| 163–170 | скелетони й порожні стани | `shared/styles/ui/states.css` |
| 171–192 | медіаблоки | `shared/styles/responsive/site.css` |

`shop.css`:

| Рядки | Вміст | Файл |
| --- | --- | --- |
| 1–11 | ціни, наявність | `features/shop/catalog/styles/price.css` |
| 12–20 | стрічки на кутах фото | `features/shop/catalog/styles/flashes.css` |
| 21–74 | слайдер першого екрана | `features/shop/home/styles/hero.css` |
| 75–87 | лукбук-секція | `features/shop/home/styles/look.css` |
| 88–108 | стрічка, бічний заголовок, Rail | `features/shop/home/styles/strip.css` |
| 109–209 | плитки товарів і розділів | `features/shop/catalog/styles/tiles.css` |
| 210–219 | переваги | `features/shop/home/styles/perks.css` |
| 220–229 | напрямки послуг на головній | `features/shop/home/styles/directions.css` |
| 230–238 | кроки «Як замовити» | `features/shop/home/styles/steps.css` |
| 239–251 | магазин у Бучі | `features/shop/home/styles/visit.css` |
| 252–256 | .facts-list | `features/shop/product/styles/facts-list.css` |
| 257–263 | .facts | `features/shop/content/styles/facts.css` |
| 264–271 | .page-head, .chips | `shared/styles/ui/page-head.css` |
| 272–278 | лістинг: .catalog, панель фільтрів | `features/shop/catalog/styles/listing.css` |
| 279–282 | .check | `shared/styles/ui/check.css` |
| 283–288 | .range, .toolbar | `features/shop/catalog/styles/listing-toolbar.css` |
| 289–305 | .seg | `shared/styles/ui/seg.css` |
| 306–311 | .pager | `shared/styles/ui/pager.css` |
| 312–351 | сторінка товару | `features/shop/product/styles/product.css` |
| 352–365 | шухляда кошика | `features/shop/cart/styles/drawer.css` |
| 366–384 | .line, .remove, .totals | `shared/styles/ui/lines.css` |
| 385–396 | .checkout, .summary | `shared/styles/ui/summary-layout.css` |
| 397–423 | сторінка кошика | `features/shop/cart/styles/cart-page.css` |
| 424–438 | поля форм, .consent | `shared/styles/ui/forms.css` |
| 439–445 | .notice | `shared/styles/ui/notice.css` |
| 446–456 | сторінка замовлення | `features/shop/order/styles/order.css` |
| 457–463 | підказки міст (.combo) | `features/shop/checkout/styles/combo.css` |
| 464–471 | послуги | `features/shop/services/styles/services.css` |
| 472–482 | .prose, .spec | `shared/styles/ui/prose.css` |
| 483–485 | контакти | `features/shop/content/styles/contacts.css` |
| 486–488 | .pay | `features/shop/payment/styles/pay.css` |
| 489–491 | .receipts | `features/shop/order/styles/receipts.css` |
| 492–500 | тестова платіжна сторінка | `features/shop/payment/styles/paypage.css` |
| 501–578 | медіаблоки | `shared/styles/responsive/shop.css` |
| 579–585 | автори фото | `features/shop/content/styles/credits.css` |

`admin.css`:

| Рядки | Вміст | Файл |
| --- | --- | --- |
| 1–26 | змінні .admin, .admin-loading | `shared/styles/admin/root.css` |
| 27–66 | каркас: бічна панель, верхня смуга | `features/admin/shell/styles/shell.css` |
| 67–82 | заголовок сторінки | `shared/styles/admin/page-head.css` |
| 83–151 | поля, прапорці, кнопки, .seg | `shared/styles/admin/controls.css` |
| 152–165 | рядок фільтрів | `shared/styles/admin/filters.css` |
| 166–187 | картки, панелі, .readonly | `shared/styles/admin/cards.css` |
| 188–228 | таблиці, чипи статусів | `shared/styles/admin/tables.css` |
| 229–242 | пейджер | `shared/styles/admin/pager.css` |
| 243–253 | вкладки | `shared/styles/admin/tabs.css` |
| 254–266 | повідомлення й стани | `shared/styles/admin/notices.css` |
| 267–275 | сітки | `shared/styles/admin/grids.css` |
| 276–285 | вхід | `features/admin/auth/styles/login.css` |
| 286–325 | медіаблоки | `shared/styles/responsive/admin.css` |
| 326–328 | висота кнопок у фільтрах і формах | `shared/styles/admin/actions.css` |

`admin-extra.css`:

| Рядки | Вміст | Файл |
| --- | --- | --- |
| 1–38 | огляд: тривоги, черга, KPI, сітка | `features/admin/dashboard/styles/overview.css` |
| 39–59 | графік | `features/admin/dashboard/styles/chart.css` |
| 60–83 | списки-стовпчики, рейтинги | `features/admin/dashboard/styles/lists.css` |
| 84–94 | масові дії | `features/admin/orders/styles/bulk.css` |
| 95–130 | палітра Ctrl+K, сповіщення | `features/admin/shell/styles/palette.css` |
| 131–156 | замовлення | `features/admin/orders/styles/order.css` |
| 157–214 | редактори, форми, контент | `shared/styles/admin/forms.css` |
| 215–247 | медіаблоки | `shared/styles/responsive/admin-screens.css` |
| 248–263 | друк накладної | `features/admin/orders/styles/print.css` |
| 264–283 | модальне вікно | `shared/styles/admin/modal.css` |

### 6.3. Перевірка каскаду

Скрипт `css-cascade.mjs` (робочий інструмент оркестратора, не частина репозиторію) розгортає `@import` з
`globals.css`, прибирає коментарі, розбиває списки селекторів і друкує по одному правилу на рядок разом із
медіаконтекстом. Вивід має збігатися з базовим знімком побайтно. Додатково зібраний CSS
(`cat web/.next/static/chunks/*.css`) має збігатися з базовим.

Фактичний результат після розбиття: вивід `css-cascade.mjs` збігається з базовим побайтно (1300 правил). Зібраний CSS
лишився одним файлом, але Turbopack починає вміст кожного імпортованого файлу з нового рядка, тож замість 6 рядків їх
76: на 69 символів `\n` більше (75 файлів замість 6), кожен — одразу після `}` правила верхнього рівня на межі файлів.
Без символів нового рядка зібраний CSS побайтно дорівнює базовому, тож різниця на каскад не впливає.

## 7. Межі в ESLint

Лише вбудоване правило `no-restricted-imports` з `regex`. У flat config пізніший блок для тих самих файлів повністю
замінює налаштування правила, тому кожен блок містить спільні заборони плюс свої:

- усі файли `src/**`: лише публічний API фіч (`index.ts` або `/server`), жодних `@/lib`, `@/components`, `@/app`;
- `src/shared/**`: ще й жодного `@/features` (ні псевдонімом, ні відносним шляхом);
- `src/features/<область>/<фіча>/**`: відносні шляхи не виходять за межі фічі, а `@/features/...` дозволено лише для
  фіч зі списку `edges[фіча]` (розділ 2). Фіча, якої немає в `edges`, не може імпортувати жодної іншої, доки її не
  додано в мапу;
- `src/app/**`: ще й жодного `@/shared` і відносних імпортів, крім `.css`.

Перевірено тимчасовими порушеннями (потім видаленими): маршрут з `@/shared/...`, сусіднім `./x` чи
`@/features/shop/cart/components/...`; `shop/catalog`, що імпортує `shop/analytics`, `admin/auth` чи власний
`@/features/shop/catalog`; `shop/analytics` → `shop/cart` (цикл); `../../cart` з компонента; нова фіча поза `edges`;
`shared` → `@/features` чи `../../features` — кожне дає помилку `npm run lint`, а дозволені ребра проходять.

Нижче — повний `web/eslint.config.mjs`.

```js
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
```

Що ESLint не ловить і що ловить збірка: клієнтський модуль, який через `server.ts` дотягнувся до `server-only`,
дає помилку `next build`.

## 8. Як додати фічу

1. Створіть `src/features/<shop|admin>/<назва>/` з `index.ts` та/або `server.ts` (серверні дані чи async-екран) і
   додайте фічу з її залежностями в `edges` у `web/eslint.config.mjs` та в розділ 2.
2. Запити: браузерні — функції в `api/client.ts` поверх `browserApi`; серверні — у `api/server.ts` з
   `import "server-only"`, `"use cache"`, `cacheLife` і `cacheTag` (тег має скидатися через `/internal/revalidate`).
3. Компоненти — у `components/`, хуки — у `hooks/`, чисті функції й підписи — у `lib/`.
   `"use client"` — лише на інтерактивних листках.
4. Експортуйте назовні тільки те, що потрібно маршрутам і іншим фічам. Серверні речі — лише з `server.ts`.
5. Маршрут у `src/app/...` імпортує екран з `@/features/<область>/<назва>` (або `/server`), тримає `metadata`
   і конфігурацію сегмента.
6. Стилі: новий сегмент `styles/<назва>.css` у фічі і рядок `@import` у `app/globals.css` на потрібному місці каскаду.
7. Перевірте: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## 9. Карта перенесення (з 583c573)

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
Так само різні `PageHead` вітрини (`shop/content`) і адмінки (`shared/admin/ui`) і різні пейджери.

## 10. Перевірки

```
cd web
npx tsc --noEmit
npm run lint
npm run build                       # таблиця маршрутів така сама, як до рефакторингу
npm run api:types && git diff --exit-code -- src/shared/api/schema.d.ts
```

Плюс знімки сторінок (DOM і пікселі, 1440 і 375 px) зібраного Docker-образу проти базових і перевірка каскаду CSS.

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
  `app/admin/(panel)/content/_lib.tsx` і `catalog/_shared.tsx`; в адмінці змінено лише шляхи імпорту. CSRF-токен
  зберігає тільки `shared/admin/csrf.ts`. Блок ESLint для `src/app/**` поки охоплює `src/app/*.{ts,tsx}`, `(shop)`,
  `pay` і `internal`; маршрути адмінки приєднаються в пакеті 2.

Пакет 2 (фічі адмінки):

- **Тимчасовий стан пакета 1 усунуто.** Копії `problemOf`, `problemText`, `problemTitle`, `fieldErrors`, `withCsrf` і `mutate`
  видалено разом із `content/_lib.tsx` і `catalog/_shared.tsx`; `mutate` скрізь замінено на `withCsrf`. Блок ESLint для
  маршрутів тепер охоплює весь `src/app/**/*.{ts,tsx}`, зокрема адмінку. У `src/app/admin` лишилися тільки `page.tsx` і
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
- **`"use client"`** стоїть на всіх екранах адмінки, на компонентах і модулях з хуками, на `use-admin-form.ts`, на
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
