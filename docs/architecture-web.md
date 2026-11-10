# Архітектура клієнта (web/)

Документ описує будову веб-клієнта PoliValko. З 2026-11-04 це npm workspace із двох застосунків і спільного пакета:

- **вітрина** `web/apps/shop` — Next.js-сайт для покупців на `<домен>` (локально http://localhost:8080);
- **консоль** `web/apps/console` — застосунок для працівників на власному піддомені (`CONSOLE_ADDRESS`, локально
  http://console.localhost:8080), маршрути — від кореня хоста за розділами меню (`/`, `/login`, `/sales/orders`,
  `/catalog/products`, `/site/home`, `/settings/shop`, `/system/staff`, …). З 2026-11-05 це односторінковий
  застосунок на ядрі консолі GBA (`gba_console`); з 2026-11-06 його збирає Next.js (статичний експорт), як вимагає
  ТЗ (розділ 15);
- **спільний пакет** `web/packages/shared` (`@polivalko/shared`) — клієнт і типи API, хелпери форматування й підписів,
  іконки й базові стилі. Клієнт, типи й хелпери беруть обидва застосунки, іконки й стилі — лише вітрина.

Розділи 1–8 і 10 описують вітрину й спільний пакет; консоль має власні шари, межі й збірку — розділ 15. Розділи 9 і
11–14 — історія перенесень: усе, що там сказано про консоль (Next.js, `globals.css`, `StaffGate`, `useConsoleData`,
бічна панель, адреси на кшталт `/orders` чи `/content/pickup`), стосується її версії до 2026-11-05. Розділ 16 — дані
вітрини, якими тепер керує консоль (банери, головна, реквізити, доставка, мітки, SEO), і їхній кеш.

Мета обох рефакторингів (фічеве розбиття, потім розділення на два застосунки) — явні межі без зміни поведінки: той
самий HTTP API, ті самі розмітка, класи, тексти, стилі, метадані й поведінка в браузері; змінилися лише адреси
панелі працівників (маршрути від кореня власного хоста, розділ 12). Згодом панель перейменовано на «консоль» (розділ 14),
а потім перебудовано з нуля як окремий SPA з правами за ключами (розділ 15) — це вже зміна поведінки, а не рефакторинг.

Версії вітрини: Next.js 16 (App Router, `cacheComponents`, `partialPrefetching`), React 19, TypeScript, ESLint 9
(flat config), npm workspaces (без turbo/pnpm/nx). Перед зміною коду вітрини читайте відповідні розділи
`web/node_modules/next/dist/docs/` (див. `web/AGENTS.md`). Версії консолі — розділ 15.

## 1. Принципи

Пункти 1–4, 6 і 7 — правила вітрини; пункт 5 стосується обох застосунків. Принципи консолі — розділ 15.1.

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
7. **Каскад CSS незмінний.** Вітрина підключає лише потрібні їй сегменти, але порядок правил той самий, що й у
   спільному CSS до розділення (розділ 6).

## 2. Шари й напрям залежностей

Шари вітрини й пакета. Шари консолі (`app` → `features` → `shared`) і її ребра між фічами — розділ 15.2.

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

Для всіх файлів вітрини заборонені також старі шляхи `@/lib/**` і `@/components/**` та імпорт іншого застосунку
(`shop/…`, `console/…` — npm workspaces створюють такі посилання в `node_modules`). Консоль має таку саму заборону у
власному `eslint.config.mjs`.

Циклічних залежностей між фічами немає. Дозволені ребра вітрини (`apps/shop`, фіча → від чого залежить):
`favorites → customer`; `cart → analytics`; `catalog → cart, favorites`;
`product → catalog, cart, analytics, favorites`; `home → catalog, services, content`;
`layout → cart, catalog, services, content, search, customer, assistant`; `search → catalog`; `checkout → cart, analytics, customer`;
`order → payment, analytics`; `account → customer, favorites, catalog, cart, checkout, order, payment`; `customer`,
`services`, `content`, `payment`, `analytics`, `assistant` — лише від `shared`.

`assistant` володіє плаваючою кнопкою, нативним діалогом, стилями та життєвим циклом 3D-сцени.
`layout` підключає його через публічний `index.ts`. Three.js імпортується динамічно після відкриття панелі;
модель завантажується з фіксованого локального шляху. Чату, голосу й серверних API помічника поки немає.

Цей список — мапа `edges` в `apps/shop/eslint.config.mjs`: імпорт фічі, якої немає серед залежностей (зокрема
власного публічного API зсередини фічі), — помилка `npm run lint` (розділ 7).

## 3. Дерево

```
web/
├─ package.json            workspace-корінь: "workspaces": ["apps/*", "packages/*"], скрипти lint/typecheck/build/api:types
├─ package-lock.json       єдиний lock-файл
├─ eslint.boundaries.mjs   правила меж для eslint.config.mjs вітрини (консоль має власні, розділ 15.2)
├─ AGENTS.md               правила Next.js для агентів (next dev пише таку саму копію у вітрину)
├─ Dockerfile              спільні етапи deps і build, кінцеві цілі shop (Next standalone) і console (Caddy зі статикою)
├─ apps/
│  ├─ shop/                вітрина (workspace "shop")
│  │  ├─ package.json  next.config.ts  tsconfig.json  eslint.config.mjs  AGENTS.md
│  │  └─ src/
│  │     ├─ app/
│  │     │  ├─ layout.tsx  globals.css  not-found.tsx  robots.ts  sitemap.ts  favicon.ico
│  │     │  ├─ internal/revalidate/route.ts
│  │     │  ├─ pay/layout.tsx  pay/sandbox/[id]/page.tsx
│  │     │  └─ (shop)/layout.tsx  error.tsx  not-found.tsx  page.tsx  cart/ catalog/ catalog/[slug]/ checkout/ contacts/ credits/
│  │     │           offer/ order/[number]/ payment-delivery/ privacy/ product/[slug]/ returns/ sale/ search/ services/
│  │     │           account/ login/ register/ forgot-password/ reset-password/ confirm-email/
│  │     │                    (cabinet)/layout.tsx page.tsx orders/ orders/[number]/ favorites/ addresses/ profile/
│  │     ├─ features/
│  │     │  ├─ analytics/   GA4: track, TrackPurchase, TrackViewItem, GoogleAnalytics
│  │     │  ├─ cart/        серверний кошик, CartProvider/useCart, useCartQuote, CartButton, CartDrawer,
│  │     │  │               CartScreen/CartView, BuyForm, AddToCart
│  │     │  ├─ catalog/     дерево розділів, пошук товарів, плитки товарів і розділів (фото й опис категорії, мітки
│  │     │  │               товарів), лістинг з фільтрами й пейджером, CatalogScreen, CategoryScreen, SaleScreen (/sale: товари зі знижкою, фільтр
│  │     │  │               знижки зафіксовано й приховано), перенаправлення
│  │     │  │               старих URL, sitemap-дані. Лістинг (з 06.11 у стилі XStore): ліва колонка 252 px з блоками
│  │     │  │               «Підрозділи», «Наявність», «Ціна» (готові діапазони priceRanges + поля від/до), «Бренд»
│  │     │  │               і характеристики (FacetGroup: пошук у списку від 9 значень, перші 6 + «Ще N»).
│  │     │  │               ListingFilters — клієнтський: прапорець застосовується одразу (router.push без прокрутки,
│  │     │  │               плитки притьмарюються), ціна з полів — після Enter чи виходу з поля; без JS — GET-форма
│  │     │  │               з кнопкою в noscript. ListingToolbar: «Показано 1–24 з N», сортування (4 варіанти) і
│  │     │  │               «Показувати 24/48/96» (pageSize у URL); над плитками — плашки вибраних фільтрів.
│  │     │  │               Плитка лістингу (tile--shop): комірки з тонкими лініями, квадратне фото, позначки
│  │     │  │               прямокутниками зліва вгорі, бренд, назва, ціна, наявність і «У кошик» на всю ширину
│  │     │  │               (AddToCart); «переглянути» й «в обране» квадратиками праворуч угорі. З 09.11 та сама плитка
│  │     │  │               й на головній, окремого варіанта look для товарів немає
│  │     │  ├─ product/     ProductScreen: галерея, блок покупки, варіанти, опис і характеристики, схожі товари, JSON-LD
│  │     │  ├─ seo/         seoMetadata (canonical, Open Graph, Twitter, noindex), JsonLd і генератори schema.org,
│  │     │  │               графік з консолі → OpeningHoursSpecification; стратегія — docs/SEO.md
│  │     │  ├─ home/        HomeScreen: блоки в порядку з консолі — слайдер із банерів, знижки, добірки, розділи,
│  │     │  │               переваги, послуги, кроки, магазин у Бучі
│  │     │  ├─ layout/      хром вітрини: ShopShell, SiteHeader (смуга оголошення, липка шапка, меню, мобільне меню),
│  │     │  │               SiteFooter (контакти, соцмережі, особливі дні, реквізити продавця), BackToTop.
│  │     │  │               Меню (09.11): «Каталог» — мегаменю з усіма розділами й їхніми підрозділами з
│  │     │  │               дерева категорій, далі прямі посилання «Акції» (лише коли є товари зі знижкою),
│  │     │  │               «Послуги», «Доставка й оплата», «Контакти»; юридичні сторінки — у футері.
│  │     │  │               Мобільне меню: розділи розгортаються в підрозділи (details), нижче сторінки
│  │     │  ├─ search/      SearchButton (панель пошуку в шапці), SearchScreen
│  │     │  ├─ checkout/    CheckoutScreen: форма, вибір міста й відділення НП, підсумок, створення замовлення
│  │     │  │               (09.11: кожен розділ карткою CheckoutStep з іконкою замість номера, способи отримання
│  │     │  │               й оплати рядками CheckoutOptions, згода з офертою в підсумку над кнопкою; стилі checkout.css)
│  │     │  ├─ order/       OrderScreen: сторінка результату замовлення, чеки, історія
│  │     │  ├─ payment/     PayButton, PaymentPending, SandboxPaymentScreen
│  │     │  ├─ services/    ServicesScreen (09.11 у стилі XStore: SplitHero, кроки, шахова сітка напрямків «картка /
│  │     │  │               фото», заявка на сірому тлі; «Залишити заявку» в картці ставить ?direction= і підставляє
│  │     │  │               напрямок у форму), ServiceRequestForm
│  │     │  ├─ content/     InfoPage (09.11: PageHead із крихтами, «Зміст» лише від 7 розділів h2/h3 тексту з консолі,
│  │     │  │               вступ виділеним блоком, розділи з якорями; реквізити продавця
│  │     │  │               в оферті — темною карткою), PageHead, ContactsScreen (картки зв'язку, бічні картки магазину з інструкцією самовивозу,
│  │     │  │               соцмереж і продавця), DeliveryScreen (/payment-delivery: картки способів отримання й оплати з
│  │     │  │               GET /checkout/delivery-methods, текст сторінки з консолі — акордеоном за заголовками h2/h3),
│  │     │  │               CreditsScreen, OfferScreen (реквізити продавця),
│  │     │  │               дані з консолі: головна й оголошення, реквізити, соцмережі, особливі дні, SEO сторінок
│  │     │  ├─ customer/    сесія покупця (зовнішнє сховище + підказка в localStorage), CSRF кабінету, вхід/реєстрація/
│  │     │  │               вихід, адреси для оформлення, AccountButton у шапці
│  │     │  ├─ favorites/   сховище id обраного, FavoriteButton (сердечко), список обраних товарів
│  │     │  └─ account/     сторінки кабінету: вхід, реєстрація, відновлення пароля, підтвердження email, AccountShell,
│  │     │                  замовлення, деталі замовлення, обране, адреси, профіль
│  │     └─ shared/
│  │        ├─ lib/quantity.ts (MAX_QUANTITY), page-title.ts (pageTitle, hasShopName)   ui/quantity-stepper.tsx,
│  │        │  ui/split-hero.tsx (банер «темна панель + фото» для послуг, доставки й контактів; без фото — для
│  │        │  текстових сторінок); ui/dropdown-select.tsx (власний випадний список замість усіх <select> вітрини: combobox + listbox,
│  │        │  стрілки, Home/End, Enter, Escape, Tab, закриття кліком поза ним; варіанти inline (тулбар лістингу)
│  │        │  і field (форми: name → прихований input, підказка, групи, пошук від 9 пунктів, aria-invalid);
│  │        │  стилі — styles/ui/dropdown-select.css. Використано: сортування й кількість у лістингу, напрямок
│  │        │  у заявці на послугу, відділення НП на оформленні й в адресах кабінету);
│  │        │  блоки .ib-* — у styles/ui/info-blocks.css
│  │        │  hooks/use-hydrated.ts
│  │        └─ styles/   print.css
│  │           ├─ ui/         stepper, fill, lines, totals, summary-layout (.css)
│  │           └─ responsive/ site, shop (.css)
│  └─ console/             консоль (workspace "console"), SPA на Next.js (статичний експорт) — будова в розділі 15.3
│     ├─ package.json  next.config.ts  dev-server.mjs  tsconfig.json  eslint.config.mjs  serve.Caddyfile
│     ├─ app/  layout.tsx  [[...slug]]/page.tsx  [[...slug]]/console-client.tsx
│     ├─ public/favicon.ico
│     └─ src/  index.css  app/  features/  shared/
└─ packages/
   └─ shared/              "@polivalko/shared" — TypeScript-джерела без власної збірки (їх компілює Next.js обох застосунків)
      ├─ package.json  tsconfig.json  eslint.config.mjs
      ├─ api/     browser.ts (browserApi, newIdempotencyKey), server.ts (api, server-only), types.ts (псевдоніми DTO),
      │           problem.ts (Problem і хелпери Problem Details), schema.d.ts (ГЕНЕРУЄТЬСЯ, не редагувати)
      ├─ lib/     format.ts, images.ts, labels.ts, stand-in-photos.ts
      ├─ ui/      icons.tsx
      └─ styles/  tokens.css, base.css, layout.css
         └─ ui/   logo, buttons, crumbs, states, page-head, check, seg, pager, buybox-meta, remove, forms, notice, prose,
                  meta-list (.css)
```

Власні `styles/` мають 14 фіч вітрини: `layout`, `search`, `home`, `catalog`, `product`, `content`, `cart`, `order`,
`checkout`, `services`, `payment`, `customer`, `favorites`, `account`. Перелік файлів — розділ 6.2.

Пакет `@polivalko/shared` не має поля `exports` і власної збірки: застосунки імпортують файли за шляхом
(`@polivalko/shared/api/browser`, `@polivalko/shared/lib/format`, `@polivalko/shared/ui/icons`), а збирач застосунку
компілює їх як його частину (Next.js обох застосунків — через `transpilePackages`). npm workspaces створюють посилання
`node_modules/@polivalko/shared → packages/shared`. Консоль бере з пакета лише `api/browser`, `api/schema`, `api/types`,
`api/problem`, `lib/format`, `lib/labels` і `lib/images`; `api/server`, `ui/icons` і `styles/**` потрібні тільки вітрині.

### 3.1. Будова фічі

Будова фічі вітрини (будова фічі консолі — розділ 15.3).

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
| `catalog` | `ProductTile`, `ProductTiles`, `ProductTilesSkeleton`, `CategoryTile`, `CategoryGrid`, `ListingSkeleton`, `ProductLabels`, `discountPercent`, `categoryPhotoUrl`, тип `SearchParams` | `getCategory`, `getCategoryTree`, `getCollections`, `getSitemap`, `resolveRedirect`, `searchProducts`, `CatalogListing`, `CatalogScreen`, `CategoryScreen`, `SaleScreen`, `SALE_TITLE`, `SALE_LEAD` |
| `product` | `descriptionText` | `getProduct`, `ProductScreen` |
| `home` | — | `HomeScreen` |
| `layout` | — | `ShopShell`, `NotFoundContent` (404 і в корені, і в `(shop)`) |
| `search` | `SearchButton` | `SearchScreen` |
| `checkout` | `CheckoutScreen`, `SettlementPicker`, `CheckoutWarehouseSelect`, `CheckoutCourierFields`, `useDeliveryPoint`, `fieldProps`, `deliveryHint` | — |
| `order` | `OrderFacts`, `OrderHistory`, `OrderItems`, `OrderReceipts`, `isOrderPaid`, `orderWhere` | `OrderScreen` |
| `payment` | `PayButton`, `PaymentPending`, `SandboxPaymentScreen` | — |
| `services` | — | `getServiceDirections`, `ServicesScreen` |
| `content` | — | `getAnnouncement`, `getContacts`, `getSeller`, `getSiteHome`, `pageMetadata`, `socialLinks`, типи `Banner`, `SiteHome`, `TextItem`, `InfoPage`, `ContactsScreen`, `CreditsScreen`, `OfferScreen`, `SpecialDays`, `SiteJsonLd` |
| `seo` | `seoMetadata`, `defaultOpenGraph`, `JsonLd`, `breadcrumbJsonLd`, `itemListJsonLd`, `webSiteJsonLd`, `organizationJsonLd`, `contactPageJsonLd`, `SITE_NAME`, `SITE_LOCALE`, `SITE_LANGUAGE`, `siteUrl`, `absoluteUrl`, `organizationId`, `websiteId`, типи `SeoInput`, `Crumb`, `ListEntry`, `OrganizationSource` | — |
| `customer` | `AccountButton`, `useCustomer`, `getAddresses`, `postAddress`, `withCsrf`, тип `CsrfHeaders`, `expireOn401`, `loadSession`, `refreshSession`, `setSignedIn`, `sessionEnded`, `signIn`, `signOut`, `signUp`, `currentPath`, `loginHref`, `safeNext`, `addressPlace`, `addressTitle`, типи `CustomerAddress`, `CustomerMe`, `SaveAddressRequest` | — |
| `favorites` | `FavoriteButton`, `useFavorites`, `getFavoriteProducts`, `HeartIcon` | — |
| `account` | `LoginScreen`, `RegisterScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen`, `ConfirmEmailScreen`, `AccountShell`, `OrdersScreen`, `OrderDetailScreen`, `FavoritesScreen`, `AddressesScreen`, `ProfileScreen` | — |

Що додало розширення консолі 2026-11-05 (подробиці й кеш — розділ 16):

- `catalog/index.ts`: `ProductLabels` — мітки товару (`{ name, tone }[]`) чипами з `data-tone` (плитка й блок покупки
  товару); `categoryPhotoUrl(category)` — фото категорії з консолі (`imageUrl`) або тимчасове фото за `slug`, інакше
  `null` (плитка, мобільне меню, `openGraph` сторінки категорії); `pageTitle(title)` — `title` для `metadata`: якщо
  текст уже закінчується на «Poli Valko», повертає `{ absolute }`, щоб шаблон `%s | Poli Valko` не додав назву вдруге.
  `pageTitle` лежить у `src/shared/lib/page-title.ts`; з 2026-11-07 маршрути отримують його через `seoMetadata`
  фічі `seo` (docs/SEO.md), реекспорт з `catalog` прибрано.
- `content/server.ts`: `getSiteHome()` — `GET /api/v1/site/home` (блоки, банери, оголошення, переваги, кроки, блок
  магазину; збій API → `null`, головна тоді показує типові блоки); `getAnnouncement()` — оголошення з тієї самої
  відповіді, лише з непорожнім текстом; `getSeller()` — `GET /api/v1/seller` (футер, оферта); `pageMetadata(slug,
  fallbackTitle)` — `metadata` текстової сторінки: `seoTitle` → заголовок → запасний, `seoDescription` → підзаголовок,
  canonical `/<slug>` (`offer`, `privacy`, `returns`, `payment-delivery`); `socialLinks(contacts)` — заповнені посилання
  Instagram, Facebook, Telegram, Viber, YouTube (контакти й футер); `SpecialDays` — сьогоднішні й майбутні особливі
  дні за київським часом, `limit` для футера; типи `SiteHome`, `Banner`, `TextItem` (з `SiteHomeDto`, `HomeBannerDto`,
  `HomeItemDto`).

Публічний API фіч консолі — розділ 15.2.

## 4. Конвенції

Конвенції вітрини й пакета. Консоль іменує файли інакше (PascalCase-компоненти, сторінки `*Page`) — розділ 15.

- **Файли:** kebab-case (`checkout-form.tsx`, `use-cart-quote.ts`). Компоненти й типи — PascalCase, хуки — `useX`.
- **Екрани:** тіло сторінки, яке маршрут рендерить цілком, має суфікс `Screen` (`OrderDetailScreen`, `HomeScreen`).
  Екран з запитами — серверний (експорт із `server.ts`), інтерактивний без серверних даних — з `index.ts`.
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
  `@polivalko/shared/api/schema` (`paths`, `components`) і псевдоніми в `@polivalko/shared/api/types`. Консоль
  використовує той самий `browserApi` через власну обгортку (розділ 15.5).
- **Контексти** (`CartContext`) і модульний стан (кеш серверного кошика в пам’яті, CSRF-токен кабінету, сесія покупця, id
  обраного) створюються рівно в одному модулі.
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

Розділ описує вітрину. Консоль з 2026-11-05 не має `globals.css` і сегментів: кожен компонент імпортує власний CSS,
базу дає Mantine (розділ 15.7). Рядки таблиць нижче зі шляхами `console/…` — історія розрізання: ці файли видалено
разом із Next.js-консоллю.

### 6.1. Як влаштовано

Усі стилі вітрини глобальні й підключаються **одним** імпортом `import "./globals.css"` у `src/app/layout.tsx`. Next.js не гарантує порядок CSS, імпортованого з різних компонентів, тож компоненти CSS не імпортують.
`src/app/globals.css` — маніфест: лише `@import url("…");` відносними шляхами до сегментів у `src/shared/styles/**`,
`src/features/*/styles/**` цього застосунку і `packages/shared/styles/**` (шлях
`../../../../packages/shared/styles/…`; Turbopack має корінь `web/`, тож ці файли в межах проєкту). Вкладених
`@import` у сегментах немає.

Сегмент — суцільний шматок вихідного файлу. Правило розміщення:

- сегмент, яким користується одна фіча, лежить у цій фічі;
- яким користуються кілька фіч одного застосунку — у `src/shared/styles` цього застосунку;
- правило, яке до 2026-11-05 могло зачепити елементи **обох** застосунків, лежить у `packages/shared/styles`; тепер
  ці файли підключає лише маніфест вітрини, на тому самому місці каскаду.

Медіаблоки в кінці вихідних файлів змішують правила різних фіч, тож вони лишаються цілими в
`src/shared/styles/responsive/*` свого застосунку: інакше змінився б відносний порядок правил.

Порядок `@import` у маніфесті — це порядок спільного `globals.css` до розділення (75 сегментів), з якого викинуто
сегменти, правила яких не можуть зачепити елементи вітрини. Після розділення маніфест вітрини мав 60 рядків, після
кабінету покупця — 68 (розділ 13.4), після розширення консолі — 71 (розділ 16.3); маніфест колишньої Next.js-консолі
мав 43. Початок `apps/shop/src/app/globals.css`:

```css
@import url("../../../../packages/shared/styles/tokens.css");
@import url("../../../../packages/shared/styles/base.css");
@import url("../../../../packages/shared/styles/layout.css");
@import url("../features/layout/styles/announce.css");
@import url("../features/layout/styles/header.css");
@import url("../../../../packages/shared/styles/ui/logo.css");
@import url("../features/layout/styles/header-menu.css");
```

Кінець маніфесту вітрини — сегменти з правилами, які до розділення вітрина отримувала з CSS консолі
(розділ 12.4): `ui/meta-list.css` (з пакета) і `src/shared/styles/print.css`. `ui/seg-compact.css` прибрано 09.11:
його `.seg` перебивав картки вибору `.seg--cards` на оформленні (flex замість сітки й зайва рамка). З 10.11 між ними
стоїть `src/shared/styles/ui/motion.css` (розділ 17).

Новий сегмент додається окремим файлом у `styles/` фічі (або в `src/shared/styles/**` вітрини) і рядком `@import` у
`globals.css` там, де його правила мають стояти в каскаді. Сегменти не містять `@import` і коментарів, `@media`/`@starting-style`-блоки не розрізаються,
`@keyframes` лежать поруч зі своїм сегментом.

### 6.2. Карта сегментів

Номери рядків — за `git show 583c573:web/src/app/<файл>` (межі припадають на порожні рядки або коментарі).
Порядок у таблицях — порядок `@import` у маніфестах. Шляхи: `shop/…` = `web/apps/shop/src/…`,
`console/…` = `web/apps/console/src/…` Next.js-консолі (видалено 2026-11-05), `pkg/…` = `web/packages/shared/…`
(до 2026-11-05 підключено в обох застосунках, тепер лише у вітрині).

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
| 83–151 | поля, прапорці, кнопки, .seg | `console/shared/styles/controls.css` (поля, прапорці, кнопки); `seg-compact.css` видалено 09.11 |
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

Розділ описує вітрину й пакет; межі консолі — розділ 15.2.

Лише вбудоване правило `no-restricted-imports` з `regex`. У flat config пізніший блок для тих самих файлів повністю
замінює налаштування правила, тому кожен блок містить спільні заборони плюс свої. Блоки будує функція
`featureBoundaries(edges)` з `web/eslint.boundaries.mjs` (до 2026-11-05 нею користувалися обидва застосунки, тепер —
лише вітрина) за мапою `edges` з розділу 2:

- усі файли `src/**`: лише публічний API фіч (`index.ts` або `/server`), жодних `@/lib`, `@/components`, `@/app`,
  жодного імпорту іншого застосунку (`shop/…`, `console/…`);
- `src/shared/**`: ще й жодного `@/features` (ні псевдонімом, ні відносним шляхом);
- `src/features/<фіча>/**`: відносні шляхи не виходять за межі фічі, а `@/features/...` дозволено лише для фіч зі
  списку `edges[фіча]`. Фіча, якої немає в `edges`, не може імпортувати жодної іншої, доки її не додано в мапу;
- `src/app/**`: ще й жодного `@/shared`, `@polivalko/shared` і відносних імпортів, крім `.css`.

Пакет `packages/shared` має власний `eslint.config.mjs`: заборонені `@/…`, `shop`, `console`, сам
`@polivalko/shared`, будь-який шлях з `apps/` і відносні шляхи за межі пакета (`../../` з файлів `api/`, `lib/`, `ui/`).

Перевірено тимчасовими порушеннями (потім видаленими; згадки консолі — про її Next.js-версію): маршрут з `@/shared/...` чи `@polivalko/shared/...`;
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

`web/apps/shop/eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { featureBoundaries } from "../../eslint.boundaries.mjs";

const edges = {
  analytics: [],
  customer: [],
  favorites: ["customer"],
  cart: ["analytics", "customer"],
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

Для вітрини (сторінку чи фічу консолі — розділ 15.10):

1. Створіть `apps/shop/src/features/<назва>/` з `index.ts` та/або `server.ts` (серверні дані чи async-екран) і додайте
   фічу з її залежностями в `edges` у `apps/shop/eslint.config.mjs` та в розділ 2.
2. Запити: браузерні — функції в `api/client.ts` поверх `browserApi` з `@polivalko/shared/api/browser`; серверні — у
   `api/server.ts` з `import "server-only"`, `api` з `@polivalko/shared/api/server`, `"use cache"`, `cacheLife` і
   `cacheTag` (тег має скидатися через `/internal/revalidate`). Типи — з `@polivalko/shared/api/schema` або
   `@polivalko/shared/api/types`.
3. Компоненти — у `components/`, хуки — у `hooks/`, чисті функції й підписи — у `lib/`.
   `"use client"` — лише на інтерактивних листках.
4. Експортуйте назовні тільки те, що потрібно маршрутам і іншим фічам. Серверні речі — лише з `server.ts`.
5. Маршрут у `src/app/...` імпортує екран з `@/features/<назва>` (або `/server`), тримає `metadata`
   і конфігурацію сегмента.
6. Стилі: новий сегмент `styles/<назва>.css` у фічі і рядок `@import` у `src/app/globals.css` на потрібному місці
   каскаду.
7. Спільний з консоллю код (клієнт API, типи, форматування) — лише в `packages/shared`, і лише якщо ним справді
   користуються обидва застосунки. Стилі консоль із пакета не бере.
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
npm run typecheck                   # вітрина й консоль: next typegen + tsc --noEmit; пакет: tsc --noEmit
npm run lint                        # eslint у shop, console і packages/shared
npm run build                       # вітрина: next build (standalone); консоль: next build (export) → apps/console/out
npm run api:types && git diff --exit-code -- packages/shared/api/schema.d.ts
```

Окремий застосунок: `npm run <скрипт> -w shop`, `-w console` або `-w @polivalko/shared`.

Для вітрини плюс знімки сторінок (DOM і пікселі, 1440 і 375 px) зібраних Docker-образів проти базових і перевірка
каскаду CSS (розділ 6.3).

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

Чинними з цього розділу лишаються: окремий піддомен консолі, маршрути від кореня її хоста, `/api` через Caddy власного
хоста, cookie на хості консолі, абсолютні посилання на вітрину, Caddyfile і змінні `CONSOLE_ADDRESS` /
`CONSOLE_ALLOWED_IPS`. Код, збірка й образ Next.js-консолі замінені 2026-11-05 (розділ 15); де це важливо, нижче
позначено поточний стан.

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
- Посилання консолі на вітрину абсолютні: `siteUrl(path)` → `${SITE_URL}${path}`. Тоді це був
  `apps/console/src/shared/site-url.ts` з `SITE_URL`, вбудованим через `env` у `apps/console/next.config.ts`; зараз —
  `@/shared/lib/siteUrl` з `process.env.SITE_URL`, який `apps/console/next.config.ts` вбудовує через `env` (розділ 15.9). За замовчуванням
  `http://localhost:8080`.
- Сторінка 404 Next.js-консолі мала ту саму розмітку, що й 404 вітрини. Зараз невідома адреса консолі показує
  «Сторінку не знайдено» всередині каркаса консолі (розділ 15.4).
- Вітрина консолі не знає: невідома адреса на домені магазину — звичайна сторінка 404 вітрини, а `/api/v1/console/*`
  там закриває Caddy (404). `robots.txt` вітрини консолі не згадує; `/account` у ньому — з розділу 13.

### 12.3. Збірка, Docker, Caddy, змінні

- **Dockerfile** (`web/Dockerfile`, контекст `web/`) один для обох. Етап `deps` ставить workspace за
  `package-lock.json` і трьома `package.json`, `build` виконує `npm run build -w $APP` (`ARG APP=shop|console`).
  Тоді обидва образи збиралися одним етапом `runtime` з `.next/standalone`; з 2026-11-05 є дві кінцеві цілі:
  `shop` копіює `apps/shop/.next/standalone` (корінь трасування — `web/`, тож `server.js` лежить в `apps/shop/`) і
  `apps/shop/.next/static`, робочий каталог — `/app/apps/shop`; `console` — розділ 15.9. Копіювання порожнього
  `public/` вітрини прибрано: каталогу немає в git.
- **next.config.ts** вітрини (тоді — обох застосунків): `output: "standalone"`, `outputFileTracingRoot` і
  `turbopack.root` = `web/`, `transpilePackages: ["@polivalko/shared"]`, `cacheComponents`, `partialPrefetching`,
  `poweredByHeader` і `rewrites` `/api/*` → `API_INTERNAL_URL` (для `next dev`).
- **compose.yaml:** сервіс `web` (вітрина, `target: shop`, `APP: shop`); `console` (профіль `app`, образ
  `polivalko-console`, healthcheck `GET /login`); `caddy` залежить і від `console`. Staging — образ
  `polivalko-staging-console`, `SITE_URL` staging. Поточні налаштування сервісу `console` — розділ 15.9.
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
| `SITE_URL` | web, **console** (у консолі — лише збірка) | як і раніше | У консолі — основа абсолютних посилань на вітрину |
| `API_INTERNAL_URL` | web; console — лише `npm run dev` | `http://api:8080` у compose вітрини | У консолі — ціль проксі `/api` сервера розробки `dev-server.mjs` (розділ 15.9) |

На staging (доступ через SSH-тунель на `localhost:8081`) консоль відкривається як http://console.localhost:8081.

### 12.4. CSS після розділення

Стан на момент розділення; з 2026-11-05 маніфест і сегменти лишилися тільки у вітрини (розділ 6).

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

- **`<head>` консолі.** Кореневий макет Next.js-консолі не мав GA4 (`GoogleAnalytics`), `google-site-verification` і
  опису вітрини (`description`), які раніше успадковувалися від спільного кореневого макета; лишилися `title`
  (`%s | Консоль Poli Valko`), `robots: noindex, nofollow`, `themeColor`, шрифт і `preconnect` до Unsplash (фото на
  сторінці входу). Поточний `<head>` консолі — `apps/console/app/layout.tsx` (розділ 15.4).
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
запити й поведінка не змінилися. З 2026-11-05 політики `admin` і охоронців `AdminOnly` / `AdminOnlyNotice` немає:
доступ перевіряють права за ключами (розділ 15.6); роль `Admin` («Адміністратор»), `Seed:Users[].Role` і
`ADMIN_EMAIL` / `ADMIN_PASSWORD` лишилися.

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

## 15. Консоль на ядрі gba_console (2026-11-05)

Next.js-консоль замінено односторінковим застосунком (SPA), спершу на Vite; з 2026-11-06 його знову збирає Next.js,
але як SPA — статичний експорт без серверного рендерингу (розділ 15.12). Його ядро — каркас, таблиця, фільтри, пейджер,
модальні вікна, шухляди й перевірка прав — перенесено з консолі GBA (`gba_console`), модель прав — з `gba-server`.
Сервер для консолі той самий: `/api/v1/console/*`, cookie `pv_console`, CSRF; новими стали лише права за ключами й
ролі з власним набором прав (`docs/architecture-backend.md`, розділ 5.2). Консоль працює тільки в браузері: серверний
рендеринг, SEO й кеш Next.js їй не потрібні.

Того ж дня консоль розширено (розділ 15.11): меню «Дашборд · Продажі · Каталог · Сайт · Налаштування · Система» з
адресами за розділами й перенаправленнями зі старих, повернення, кабінети покупців, нотатка до замовлення, довідники
каталогу (характеристики, бренди, мітки), вкладки наповнення й масові дії в товарах, сайт (головна, банери, SEO) і
налаштування магазину (контакти й реквізити, доставка, оплата й чеки, сповіщення). Сервер цих екранів —
`docs/architecture-backend.md`, розділи 5.2–5.4.

Версії: React 19.3, React Router 7, Mantine 9 (`core`, `dates`, `hooks`, `notifications`), TanStack Table 8,
`@tabler/icons-react`, `dayjs` (локаль `uk`), шрифт Onest з `@fontsource/onest` (локально, без CDN), Next.js 16.4
(Turbopack, `output: "export"`), TypeScript 5, ESLint 9 з `eslint-config-next` 16.4 (core-web-vitals і typescript).

### 15.1. Принципи

1. **Один реєстр маршрутів.** Шлях, заголовок, ключ права й сторінка кожного маршруту, а також перенаправлення старих
   адрес записані в `src/app/routes/consoleRoutes.ts`. Меню має власну модель з тими самими ключами, адреса сторінки
   починається з префікса її розділу меню.
2. **Кожен маршрут вимагає право.** Сторінка не повторює перевірку маршруту, а лише ховає чи вимикає дії, яким
   потрібні інші ключі. Остаточно права перевіряє сервер; консоль тільки не показує недоступного.
3. **Фіча володіє своїм:** запитами (`api/`), компонентами, станом і логікою (`lib/`), сторінками (`pages/`) і CSS поруч
   із компонентом.
4. **`shared` — нижній шар.** Він не знає ні фіч, ні `app`.
5. **Сигнали між фічами — подіями.** Оновити лічильники меню, перечитати права чи відкрити пошук фіча просить через
   `@/shared/lib/events`, а не імпортом іншої фічі.
6. **Стан списку — в адресі.** Фільтри, сортування, сторінка й розмір сторінки живуть в URL, тож посиланням можна
   поділитися, а «Назад» повертає попередню вибірку.
7. **Без коментарів у коді** і без рядків `eslint-disable`: винятки з правил лише в `eslint.config.mjs`.

### 15.2. Шари й межі

```
src/app (каркас, провайдери, реєстр маршрутів)
   │  бере з фіч лише index.ts і pages/*
   ▼
src/features/<фіча>  ──►  index.ts інших фіч, лише за edges
   │
   ▼
src/shared  ──►  @polivalko/shared (крім api/server)
```

| Шар | Може імпортувати | Не може імпортувати |
| --- | --- | --- |
| `src/app/**` | `@/features/<фіча>` (її `index.ts`), `@/features/<фіча>/pages/<Сторінка>`, `@/shared/**`, `@polivalko/shared/**` | інші внутрішні файли фіч |
| `src/features/<фіча>/**` | власні файли відносними шляхами, `@/shared/**`, `@polivalko/shared/**`, `index.ts` фіч зі списку `edges` | `@/app/**`, відносні шляхи за межі фічі, глибокі шляхи інших фіч |
| `src/shared/**` | `@/shared/**`, `@polivalko/shared/**`, сторонні пакети | `@/features/**`, `@/app/**` (ні псевдонімом, ні відносним шляхом) |

Для всіх файлів заборонені також імпорт іншого застосунку (`shop/…`, `console/…`) і `@polivalko/shared/api/server`
(серверний клієнт API вітрини). Псевдонім `@/` — це `src/`.

Ребра між фічами (`edges` в `apps/console/eslint.config.mjs`, список `features` — 15 фіч): кожна фіча може брати
`auth`; `navigation` — лише `auth`; `search` — ще й `navigation`; `site` — ще й `content` і `catalog`; `settings` — ще й
`content` і `integration`; `auth` не залежить від жодної. Ребра `site` і `settings` до `content`, `catalog` та
`integration` дозволені наперед і зараз не використовуються: ці три фічі не мають `index.ts`, а `site` і `settings`
тримають власні дрібні копії (`FormAlert`, `ListError`, `SectionCard`, `lib/useSaveForm.ts`, у `site` — ще й
`ImageField`). Фактично
фічі імпортують лише `@/features/auth` і (з `search`) `@/features/navigation`. Публічний API (`index.ts`) мають
три фічі:

| Фіча | `index.ts` |
| --- | --- |
| `auth` | `AuthProvider`, `useAuth`, `usePermissions`, `Can`, `PermissionGate`, `AccessDenied`, `PagePermissionBoundary`, `ProtectedRoute`, `ChangePasswordModal`, `TwoFactorModal`, `TwoFactorCodeInput`, `useTwoFactorStatus`, `LoginPage`, типи `AuthContextValue`, `AuthStatus` |
| `navigation` | `NavigationProvider`, `useNavigation`, `NAV_SECTIONS`, `findActive`, `isNavItemAllowed`, `matchesPath`, `sectionByPrefix`, типи `ConsoleSummary`, `NavBadgeTone`, `NavItem`, `NavSection` |
| `search` | `SearchPalette`, `SearchButton` |

Сторінки решти фіч бере лише реєстр маршрутів (`app/routes/lazyConsolePages.ts`, `React.lazy`), тож `index.ts` їм не
потрібен. Нове ребро — запис у `edges` і експорт із `index.ts` фічі-залежності.

`eslint.config.mjs` — flat config без спільного `web/eslint.boundaries.mjs`: `eslint-config-next` (core-web-vitals і
typescript, як у вітрини; разом з ним `react-hooks` 7 з правилами React Compiler: без синхронного `setState` у тілі
ефекту, без читання ref під час рендеру), `@next/next/no-img-element` вимкнено і правила `no-restricted-imports` з
таблиці вище. Єдиний виняток —
`react-hooks/incompatible-library` вимкнено для `src/shared/ui/data-table/DataTable.tsx` (TanStack Table).

### 15.3. Дерево

```
web/apps/console/
├─ next.config.ts        output: "export" для збірки (у next dev — без нього), turbopack.root, transpilePackages, env.SITE_URL
├─ dev-server.mjs        сервер розробки: Next.js (dev) + проксі /api із заданим Host (розділ 15.9)
├─ app/                  маршрути Next.js; src/app ним не є: Next ігнорує src/app, коли в корені є app/
│  ├─ layout.tsx         <html lang="uk" translate="no">, ColorSchemeScript Mantine, metadata (назва, robots noindex,
│  │                     nofollow, google notranslate, favicon), viewport.themeColor, index.css, #root
│  └─ [[...slug]]/       page.tsx — одна сторінка на всі адреси (generateStaticParams → лише /);
│                        console-client.tsx — next/dynamic(ConsoleRoot, { ssr: false })
├─ serve.Caddyfile       роздача out/ у контейнері (розділ 15.9)
├─ eslint.config.mjs     межі шарів і фіч (розділ 15.2)
├─ tsconfig.json         як у вітрини (плагін next, @/* → src/*) + noUnusedLocals, noUnusedParameters
├─ public/favicon.ico
└─ src/
   ├─ index.css          Onest (@fontsource), стилі Mantine, токени бренду
   ├─ app/               каркас консолі (не маршрути Next.js)
   │  ├─ ConsoleRoot.tsx installApiMiddleware(), AppErrorBoundary → AppProviders → App
   │  ├─ App.tsx         /login, захищений макет, маршрути з реєстру, 404
   │  ├─ providers/      MantineProvider(theme) → DatesProvider(uk) → Notifications → BrowserRouter → AuthProvider
   │  ├─ layout/         ConsoleLayout; components/: ConsoleHeader, ConsoleSectionNav, ConsoleSectionTabs,
   │  │                  ConsoleMobileNav, ConsoleAccountMenu, ConsoleMain, NavBadge; layout.css
   │  └─ routes/         consoleRoutes.ts (реєстр маршрутів і перенаправлень), lazyConsolePages.ts,
   │                     ConsoleRouteElement.tsx, ConsoleRedirect.tsx (PathRedirect, SectionRedirect), lazyRoute.tsx
   ├─ features/
   │  ├─ auth/           сесія й права (AuthProvider, usePermissions), вхід, ProtectedRoute, Can, AccessDenied,
   │  │                  PagePermissionBoundary, зміна власного пароля
   │  ├─ navigation/     модель меню (розділи, пункти, ключі, бейджі), NavigationProvider, зведення /console/summary
   │  ├─ search/         кнопка пошуку й палітра Ctrl+K
   │  ├─ dashboard/      Дашборд: стан, черга, «Потребує уваги» (лічильники товарів), показники
   │  ├─ orders/         список (еталон сторінки списку) і картка замовлення з друком і нотаткою для працівників
   │  ├─ returns/        список повернень коштів (ReturnsPage)
   │  ├─ customers/      покупці: вкладки «За замовленнями» й «Кабінети», картка кабінету (AccountPage)
   │  ├─ requests/       заявки на послуги
   │  ├─ catalog/        товари (вкладки наповнення, масові дії) і редактор товару, категорії, довідники
   │  │                  характеристик, брендів і міток (AttributesPage, BrandsPage, LabelsPage), добірки, імпорт
   │  ├─ content/        текстові сторінки й редактор (з SEO), напрямки послуг (з фото)
   │  ├─ site/           головна (HomeSettingsPage), банери (BannersPage), SEO: перенаправлення й мета-шаблони (SeoPage)
   │  ├─ settings/       магазин (контакти, особливі дні, реквізити), доставка й точки самовивозу, оплата й чеки,
   │  │                  сповіщення (ShopSettingsPage, DeliverySettingsPage, PaymentSettingsPage, NotificationSettingsPage)
   │  ├─ integration/    фонові завдання, запуски, черга операцій, Нова пошта
   │  ├─ audit/          журнал змін
   │  └─ staff/          працівники, ролі і права
   └─ shared/
      ├─ api/            client.ts (api, installApiMiddleware, apiFetch), csrf.ts, problem.ts, useApiQuery.ts, download.ts
      ├─ auth/           permissionKeys.ts, permissions.ts, permissionsApi.ts
      ├─ lib/            events.ts, siteUrl.ts, useDocumentTitle.ts
      ├─ theme/          theme.ts; CSS чипів, алертів, полів вибору (Select), сегментованих перемикачів
      └─ ui/             data-table/, paginator/, page-header-actions/, ListPage, FilterBar, ScreenTabs, PageHeader,
                         PageState, PlaceholderPage, AppModal, AppDrawer, ConfirmDialog, AppDateInput, DateRangeFilter,
                         AppErrorBoundary, StatusChip, TableChip, Money (Money, NumberValue, CellStack), notify
```

Будова фічі: `features/<фіча>/{api,components,lib,pages}`, `index.ts` — лише якщо фічу імпортують інші. Сторінка —
`pages/<Назва>Page.tsx` з іменованим експортом (`export function AuditPage()`), поруч її CSS (`audit.css`). Файли
компонентів — PascalCase (`OrdersFilters.tsx`), колонки таблиць — `<назва>Columns.tsx`, стан списку —
`lib/use<Назва>State.ts`, запити — `api/<назва>Api.ts`. Класи мають префікс фічі (`orders-…`, `audit-…`).

### 15.4. Маршрути й каркас

Адреса повторює меню: `/sales/…`, `/catalog/…`, `/site/…`, `/settings/…`, `/system/…`.

| Шлях | Заголовок | Сторінка (`features/…/pages`) | Право |
| --- | --- | --- | --- |
| `/` | Дашборд | `dashboard/DashboardPage` | `dashboard.page.view`; без нього `/` веде на перший доступний пункт меню (`redirectWhenDenied`) |
| `/sales/orders`, `/sales/orders/:number` | Замовлення | `orders/OrdersPage`, `OrderPage` | `orders.page.view` |
| `/sales/requests` | Заявки | `requests/RequestsPage` | `requests.page.view` |
| `/sales/returns` | Повернення | `returns/ReturnsPage` | `orders.page.view` |
| `/sales/customers` | Покупці | `customers/CustomersPage` (`?tab=accounts` — «Кабінети») | `customers.page.view` |
| `/sales/customers/accounts/:id` | Кабінет покупця | `customers/AccountPage` | `customers.page.view` |
| `/catalog/products`, `/catalog/products/:id` | Товари, Товар | `catalog/ProductsPage`, `ProductPage` | `catalog.products.view` |
| `/catalog/categories` | Категорії | `catalog/CategoriesPage` | `catalog.categories.manage` |
| `/catalog/attributes` | Характеристики | `catalog/AttributesPage` | `catalog.attributes.manage` |
| `/catalog/brands` | Бренди | `catalog/BrandsPage` | `catalog.brands.manage` |
| `/catalog/labels` | Мітки | `catalog/LabelsPage` | `catalog.labels.manage` |
| `/catalog/collections` | Добірки | `catalog/CollectionsPage` | `catalog.collections.manage` |
| `/catalog/import` | Імпорт (без пункту меню) | `catalog/ImportPage` | `catalog.import.run` |
| `/site/home` | Головна | `site/HomeSettingsPage` | `site.home.manage` |
| `/site/banners` | Банери | `site/BannersPage` | `site.home.manage` |
| `/site/pages`, `/site/pages/:slug` | Сторінки, Сторінка | `content/ContentPagesPage`, `ContentPageEditorPage` | `content.site.manage` |
| `/site/services` | Послуги | `content/ServicesPage` | `content.site.manage` |
| `/site/seo` | SEO | `site/SeoPage` (`?tab=redirects` або `?tab=templates`) | `catalog.redirects.manage` або `site.seo.manage` (`alsoAllowedBy`); кожна вкладка — лише зі своїм ключем |
| `/settings/shop` | Магазин | `settings/ShopSettingsPage` | `settings.shop.manage` |
| `/settings/delivery` | Доставка | `settings/DeliverySettingsPage` | `delivery.pickup.manage` |
| `/settings/payments` | Оплата й чеки | `settings/PaymentSettingsPage` | `integration.status.view` |
| `/settings/notifications` | Сповіщення | `settings/NotificationSettingsPage` | `settings.notifications.manage` |
| `/system/integrations` | Інтеграції | `integration/IntegrationPage` | `integration.status.view` |
| `/system/staff` | Працівники | `staff/StaffPage` | `staff.users.manage` |
| `/system/roles` | Ролі і права | `staff/RolesPage` | `staff.roles.manage` |
| `/system/audit` | Журнал | `audit/AuditPage` | `audit.page.view` |

`/login` — без права; будь-яка інша адреса — «Сторінку не знайдено» всередині каркаса.

**Перенаправлення старих адрес** (`consoleRedirects` у `consoleRoutes.ts`, `PathRedirect` — `<Navigate replace>`;
параметри шляху підставляються, query й hash зберігаються, а query з цілі, як-от `tab=redirects`, має пріоритет):

| Було | Стало |
| --- | --- |
| `/orders`, `/orders/:number` | `/sales/orders`, `/sales/orders/:number` |
| `/customers`, `/requests` | `/sales/customers`, `/sales/requests` |
| `/catalog/redirects` | `/site/seo?tab=redirects` |
| `/content`, `/content/pages`, `/content/pages/:slug` | `/site/pages`, `/site/pages/:slug` |
| `/content/services` | `/site/services` |
| `/content/contacts` | `/settings/shop` |
| `/content/pickup` | `/settings/delivery` |
| `/integration`, `/audit` | `/system/integrations`, `/system/audit` |
| `/staff`, `/staff/roles` | `/system/staff`, `/system/roles` |

Голі префікси `/sales`, `/catalog`, `/site`, `/settings`, `/system` (`sectionRedirects`, `SectionRedirect`) ведуть на
перший пункт розділу, доступний працівнику, або показують «Сторінку не знайдено», якщо доступного немає; так колишня
адреса списку товарів `/catalog` відкриває «Товари». Усі внутрішні посилання консолі (дашборд, журнал, пошук, картки)
використовують нові адреси.

`ConsoleRouteElement` для кожного маршруту з реєстру: чекає, доки завантажаться права; без права (і без жодного з
`alsoAllowedBy`) показує `AccessDenied` («Недостатньо прав»: якій ролі не надано яке право, кнопка «На головну» на
перший доступний пункт), а маршрут із `redirectWhenDenied` (лише `/`) замість цього веде на перший доступний пункт;
ставить заголовок вкладки `<заголовок> · Консоль PoliValko`; загортає ліниву сторінку в `Suspense` і
`AppErrorBoundary` («Щось пішло не так» замість білого екрана).

**Вхід.** `ProtectedRoute` показує лоадер, поки сесія невідома, а гостя веде на `/login`, запам'ятавши адресу в
`state.from`; після входу консоль повертає туди. Повертає лише на локальний шлях (не `//…`, не `/\…`, не `/login`).
Якщо сесія закінчилася посеред роботи (401 на будь-якому запиті, крім входу й зміни пароля), адреса зберігається в
`sessionStorage` (`pv-console:return-path`), CSRF-токен забувається, а після повторного входу консоль відкриває ту саму
сторінку.

**Каркас** (`ConsoleLayout` на Mantine `AppShell`, шапка 108 px у два ряди):

- ряд 1: «PoliValko» з позначкою «консоль» (посилання на `/`); розділи Дашборд / Продажі / Каталог / Сайт /
  Налаштування / Система (`ConsoleSectionNav`) — звичайні посилання з сумарним бейджем розділу: кожне веде на першу
  сторінку розділу, доступну працівнику, активний розділ підсвічено; кнопка «Пошук» з підказкою Ctrl K; кнопка вітрини
  (нова вкладка); меню облікового запису (ім'я, email, роль, «Змінити пароль», «Вийти»);
- ряд 2 — заголовок сторінки: вкладки поточного розділу з бейджами (`ConsoleSectionTabs`) — єдине місце, де на широкому
  екрані видно сторінки розділу. Вкладки малюються, лише коли працівнику доступні хоча б дві сторінки розділу (у
  «Дашборда» їх немає). На сторінках деталей замість вкладок — заголовок сторінки, наприклад хлібні крихти замовлення,
  кабінету покупця чи імпорту; праворуч дії сторінки, які сторінка передає через `PageHeader`;
- на ширині до 64em (1024 px) меню розділів ховається, з'являється бургер з лівою шухлядою з усіма розділами,
  пошук стає іконкою; до 36em кнопки дій з іконкою стискаються до іконки (підпис лишається для екранних читачів);
- робоча рамка `.console-frame` під шапкою: сторінка списку займає її всю й сама не прокручується (прокручується
  таблиця), форми й картки прокручують рамку.

**Меню** (`features/navigation/lib/navigationModel.ts`):

| Розділ (`prefix`) | Пункти | Бейдж |
| --- | --- | --- |
| Дашборд | Дашборд (`/`) | — |
| Продажі (`/sales`) | Замовлення, Заявки, Повернення, Покупці | Замовлення — нові й ті, що чекають підтвердження; Заявки — нові |
| Каталог (`/catalog`) | Товари, Категорії, Характеристики, Бренди, Мітки, Добірки | — |
| Сайт (`/site`) | Головна, Банери, Сторінки, Послуги, SEO | — |
| Налаштування (`/settings`) | Магазин, Доставка, Оплата й чеки, Сповіщення | — |
| Система (`/system`) | Інтеграції, Працівники, Ролі і права, Журнал | Інтеграції — невиконані операції черги (червоний) |

Пункт без права прихований (`isNavItemAllowed`: ключ пункту або будь-який з `alsoAllowedBy`, як у «SEO»), розділ без
доступних пунктів зникає, а посилання розділу у верхньому ряду веде на перший доступний пункт (наприклад, без права на
замовлення «Продажі» відкривають «Заявки»). Активний пункт — найдовший шлях, що збігається з адресою; сторінка без
пункту меню (`/catalog/import`) підсвічує розділ за `prefix`. Бейджі беруться з `GET /api/v1/console/summary` (кожні
60 с і після `notifySummaryStale()`); бейдж розділу — сума бейджів його пунктів, червоний, якщо серед них є червоний.

**Пошук Ctrl+K** (`SearchPalette`): відкривається Ctrl/⌘+K, клавішею `/` поза полями вводу або кнопкою в шапці. До двох
символів показує доступні пункти меню; з двох — `GET /api/v1/console/search?q=` (затримка 180 мс) з групами
«Замовлення», «Товари», «Покупці». Групи, на які немає права, сервер не повертає. Стрілки вибирають, Enter відкриває.

**`<head>`** задає `app/layout.tsx`: `lang="uk"`, `translate="no"`, `robots: noindex, nofollow`, `theme-color`, favicon і
базова назва «Консоль PoliValko». Заголовок вкладки ставлять `useDocumentTitle` / `useDefaultDocumentTitle`.

### 15.5. API, CSRF і дані

- **Клієнт.** `api` з `@/shared/api/client` — той самий openapi-fetch `browserApi` з пакета з middleware, яку
  `ConsoleRoot.tsx` ставить один раз (`installApiMiddleware`): відповідь 401 (крім `/auth/login` і `/auth/password`) — подія
  `unauthorized`, вихід і повернення після входу. `apiFetch(url, init)` — те саме для звичайного `fetch` (CSV, файли).
- **CSRF** (`@/shared/api/csrf`): токен з `GET /api/v1/console/auth/csrf` кешується промісом;
  `withCsrf((headers) => api.POST(…, { headers, body }))` додає `X-CSRF-TOKEN` і один раз повторює запит після
  `auth.csrf_invalid`; `forgetCsrf()` — після входу й виходу. Функції в `api/*Api.ts` фіч приймають заголовки першим
  аргументом. Фото товару й файл імпорту йдуть через `apiFetch` з `FormData` і тим самим повтором.
- **Читання.** `useApiQuery(key, loader, { enabled })` → `status` (`loading`, `ready`, `error`, `forbidden` для 403),
  `data`, `problem`, `isLoading`, `isFetching`, `reload`, `setData`. Ключ — серіалізований запит
  (`orders:${JSON.stringify(query)}`); поки вантажиться новий ключ, лишаються попередні дані, і таблиця лише тьмяніє.
- **Помилки й повідомлення.** `problemMessage(error, fallback)` (окремо обробляє `auth.forbidden`), `fieldErrors(error)`
  → `{ поле: текст }`, `problemCode`, `NETWORK_ERROR`. Сповіщення Mantine внизу праворуч: `notifySuccess`,
  `notifyError`, `notifyInfo`, `notifyProblem`.
- **Події** (`@/shared/lib/events`, `CustomEvent` `pv-console:*` на `window`): `unauthorized`;
  `permissions-changed` — `notifyPermissionsChanged()` після збереження ролі чи працівника, щоб інтерфейс поточного
  користувача перечитав права; `summary-stale` — `notifySummaryStale()` після дій, що змінюють лічильники меню;
  `open-search`.
- **Ідемпотентність.** Повернення коштів надсилає `Idempotency-Key` з `newIdempotencyKey()` пакета, один ключ на
  спробу форми.
- **Файли.** `downloadFile(url, fallbackName)` (CSV замовлень) бере ім'я файлу з `Content-Disposition`.

### 15.6. Права в інтерфейсі

- **Ключі** — `@/shared/auth/permissionKeys`: `PermissionKeys` (напр. `PermissionKeys.Catalog.EditProducts` =
  `catalog.products.edit`), тип `PermissionKey`, `PERMISSION_LABELS` (назви, як у каталозі сервера), `PERMISSION_KEYS`,
  `PERMISSION_CATALOG_VERSION` (`2026-11-06.1`, 30 ключів). Рядки ті самі, що в `PermissionKeys` бекенду
  (`docs/architecture-backend.md`, розділ 5.2). Групи консолі: `Dashboard`, `Orders`, `Customers` (+ `ManageAccounts` =
  `customers.accounts.manage`), `Requests`, `Catalog` (+ `ManageAttributes`, `ManageBrands`, `ManageLabels`),
  `Content` (`ManageSite` = `content.site.manage`, `ManagePickup` = `delivery.pickup.manage` — ключі ті самі, хоча в
  каталозі сервера вони тепер у розділах «Сайт» і «Налаштування»), `Site` (`ManageHome`, `ManageSeo`), `Settings`
  (`ManageShop`, `ManageNotifications`), `Integration`, `Audit`, `Staff`.
- **Сесія** (`AuthProvider`): `GET /auth/me`, потім `GET /permissions/me` (`roleId`, `roleName`, `isSuperuser`,
  `permissionKeys`, `catalogVersion`). Права перечитуються, коли вікно отримує фокус (не частіше ніж раз на 30 с), і
  після `notifyPermissionsChanged()`. Суперкористувач (роль «Адміністратор») проходить будь-яку перевірку.
- **Хелпери** з `@/features/auth`:
  - `usePermissions()` → `can(key)`, `cannot`, `canAny([...])`, `isSuperuser`, `roleName`, `permissionKeys`, `isLoading`;
  - `<Can permission mode="hide|disable" fallback deniedReason>` — ховає дію або вимикає її з підказкою «Недостатньо
    прав для цієї дії»; `<PermissionGate permissionKey>` — те саме для блоку;
  - `<PagePermissionBoundary permissionKey homePath>` — для частини сторінки, якій потрібне власне право: лоадер, поки
    права вантажаться, без права — `AccessDenied`;
  - `<AccessDenied permissionKey homePath>` — екран «Недостатньо прав»;
  - `useAuth()` → `me`, `permissions`, `hasPermission`, `login(email, password, twoFactorCode?)`, `logout`, `refresh`.
- **Двофакторна перевірка.** `login` повертає `twoFactor: 'required' | 'invalid'` на 401 `auth.two_factor_required` /
  `auth.invalid_two_factor_code`; `LoginPage` тоді показує другий крок: код із застосунку або резервний код
  (`TwoFactorCodeInput`, `autocomplete="one-time-code"`). `TwoFactorModal` (меню облікового запису) веде стан → ключ і
  QR (бібліотека `qrcode`, як у gba_ecommerce) → код → 10 резервних кодів (скопіювати, завантажити .txt), а з
  увімкненою перевіркою — нові резервні коди чи вимкнення з поточним кодом. `StaffUserModal`, коли роль стає
  адміністраторською, бере `useTwoFactorStatus()`: без перевірки — попередження з кнопкою «Налаштувати» (вкладений
  `TwoFactorModal`), з перевіркою — поле «Ваш код підтвердження»; помилки `staff.two_factor_required|invalid`
  показуються під полем. У таблиці працівників — колонка «Двофакторна» і кнопка скидання (`ResetTwoFactorModal`).
- **Три рівні:** маршрут (реєстр), пункт меню (модель навігації), дія на сторінці (`can` / `<Can>`). Маршрут і пункт
  меню можуть мати `alsoAllowedBy` — додаткові ключі, будь-якого з яких досить (зараз лише «SEO»). Дії під окремими
  ключами: «Експорт CSV» — `orders.export`; вибір рядків, масова зміна статусу, панель «Змінити статус» і редагування
  нотатки для працівників — `orders.status.change`; форма повернення — `orders.refund.create`; блокування кабінету й
  лист для скидання пароля — `customers.accounts.manage`; зміна статусу заявки — `requests.status.change`; збереження
  товару, вибір рядків і масові дії в товарах — `catalog.products.edit` (без нього редактор товару лише для перегляду);
  вкладки «Перенаправлення» й «Мета-шаблони» на `/site/seo` — `catalog.redirects.manage` і `site.seo.manage`;
  «Запустити зараз» — `integration.jobs.run`; вкладка «Черга операцій» — `integration.outbox.manage`; «Імпорт» на
  товарах і «Імпорт каталогу з файлу» на інтеграціях — `catalog.import.run`; історія імпортів — `integration.status.view`.
  Посилання на іншу сторінку (з дашборда, журналу, покупців, картки замовлення чи кабінету, на довідники брендів, міток
  і характеристик з редакторів товару й категорії) показуються, лише якщо є право її відкрити.
- **API ролей** (`@/shared/auth/permissionsApi`, типи зі згенерованої схеми): `getPermissionCatalog`,
  `getMyPermissions`, `getRoles`, `createRole`, `updateRole`, `deleteRole`, `getRolePermissions`,
  `updateRolePermissions(headers, id, { expectedVersion, permissionKeys })`.

**Сторінка «Ролі і права»** (`features/staff/pages/RolesPage.tsx`, `/system/roles?role=<id>`):

- ліворуч — список ролей (Адміністратор, далі системні, далі власні за абеткою) з кількістю працівників і прав та
  позначками «Системна», «Повний доступ», «Ваша роль»; «Нова роль» — у шапці;
- праворуч — підсумок ролі («Змінити», «Видалити»), рядок фільтрів (пошук за назвою, описом чи ключем; ризик; стан:
  вибрані, не вибрані, змінені; «Вибрати все» / «Очистити» або «Вибрати показані» / «Зняти показані»), дерево прав за
  розділами каталогу з лічильником `вибрано/усього`, позначками змін («додано», «знято») і ризику;
- права, яких немає в ролі поточного працівника, позначено замком: увімкнути їх не можна, зняти — можна (так само
  перевіряє сервер, `roles.escalation`); Адміністратор цих обмежень не має;
- нижня панель: «Змін: n» (додано, знято), «Скасувати зміни», «Зберегти». Збереження надсилає повний набір ключів з
  `expectedVersion`. 409 `roles.version_conflict` → «Права ролі вже змінив інший працівник» і кнопка «Завантажити
  актуальні права»; якщо версія каталогу на сервері не збігається з версією в правах ролі, збереження заблоковано до
  перезавантаження; зняття права «Ролі та права» з власної ролі попереджає, що сторінка стане недоступною;
- незбережені зміни захищено: вибір іншої ролі, перехід за посиланням консолі чи «Оновити» питають «Відхилити зміни?»,
  закриття вкладки — стандартне попередження браузера;
- роль «Адміністратор» — лише перегляд; роль, призначену працівникам, не видалити (діалог пропонує «Відкрити
  працівників» з фільтром за цією роллю).

### 15.7. Списки, таблиці, форми, стилі

Сторінка списку (еталон — `features/orders/**`):

```tsx
<ListPage>
  <PageHeader title="Замовлення" actions={<Can permission={PermissionKeys.Orders.Export}>…</Can>} />
  <OrdersStatusTabs … />
  <OrdersFilters … actions={<Paginator … />} />
  <ListPageBody>
    <DataTable height="100%" manualSorting selection={…} … />
  </ListPageBody>
  {selected.size > 0 ? <OrdersBulkBar … /> : null}
</ListPage>
```

- **`ListPage`** займає всю робочу рамку й не прокручується; **`ListPageBody`** віддає висоту таблиці;
  **`ListPageFooter`** — смуга масових дій під таблицею.
- **`PageHeader`** — заголовок вкладки (`title`), кнопки в другому ряду шапки (`actions`; кнопкам потрібна іконка
  `leftSection`, бо на вузькому екрані лишається тільки вона), `heading` замість вкладок розділу (сторінки деталей).
- **`FilterBar`** — один рядок: поле `search` видно завжди; інші фільтри на ширині до 48em ховаються за кнопкою
  «Фільтри (n)»; `actions` праворуч — скидання фільтрів, «Знайдено: n», пейджер. Пошук спрацьовує через 350 мс, Enter —
  одразу.
- **`Paginator`** — розмір сторінки (20, 40, 60, 100), поле номера сторінки, попередня / наступна, «Оновити».
- **`ScreenTabs`** — вкладки з лічильниками всередині сторінки (статуси замовлень і заявок, вибірки товарів, «За
  замовленнями» / «Кабінети» в покупцях, «Перенаправлення» / «Мета-шаблони» в SEO, розділи інтеграцій); `hot`
  підсвічує ненульовий лічильник. Обрана вкладка живе в адресі (`?tab=`, у товарах — набір фільтрів).
- **`DateRangeFilter`** — пара дат «Від» / «До» для `FilterBar` (замовлення, повернення).
- **`DataTable`** (TanStack Table 8): колонки `DataTableColumn` (`id`, `header`, `accessor`, `cell`, `width`,
  `minWidth`, `maxWidth`, `align`, `numeric`, `fill`, `enableSorting`, `sortDescFirst`); липкий заголовок і прокрутка
  всередині; колонка, що забирає вільну ширину; скелет при першому завантаженні (`isLoading`) і притемнення під час
  нового запиту (`isFetching`); порожній стан (`emptyText`); горизонтальна прокрутка нижче `minWidth`; серверне
  (`manualSorting`) або клієнтське сортування; `onRowClick` (клік по посиланню, кнопці чи полю в рядку рядок не
  відкриває); вибір рядків (`selection`, прапорець «усі на сторінці»). З gba свідомо не перенесено перетягування й
  закріплення колонок, зміну ширини, меню видимості, збережений макет, перемикач щільності й розгортання рядків.
- **Стан в URL.** `features/orders/lib/useOrdersState.ts` і `orderFilters.ts` читають і пишуть `q`, `status`,
  `paymentStatus`, `delivery`, `from`, `to`, `sort`, `page`, `pageSize` через `useSearchParams` (`replace`): типові
  значення в адресу не пишуться, зміна фільтра скидає сторінку. Вибір рядків прив'язаний до адреси й скидається з
  будь-якою зміною фільтра чи сторінки.
- **Вікна.** `AppModal` + `AppModalFooter` — форми (працівник, роль, пароль); `ConfirmDialog` — видалення й масові
  дії; `AppDrawer` — права шухляда (`compact`, `standard`, `wide`) з прокручуваним тілом і закріпленим футером для
  редагування без втрати списку з очей (категорія, характеристика, бренд, мітка, добірка, банер, точка самовивозу,
  напрямок послуг, запис журналу);
  `AppDateInput` — дата `YYYY-MM-DD` з уводом `дд.мм.рррр`.
- **Стани й комірки.** `PageState kind="loading|error|forbidden|empty"` з `onRetry`; `CellStack`, `Money`,
  `NumberValue`, `OrderStatusChip`, `PaymentStatusChip`, `RequestStatusChip`, `TableChip` (тони `neutral`, `document`,
  `product`, `source`, `storage`, `success`, `warning`, `danger`).

Стилі: тема Mantine (`shared/theme/theme.ts`: шрифт Onest, `primaryColor: brand`, відтінок 6 = `#00A046`, наведення —
`#008a3c`, текст `#1a1a1a`) і токени в `src/index.css` (`--brand-accent`, `--brand-accent-hover`,
`--brand-accent-soft`, `--brand-ink`, `--app-ground`, `--app-hot`, `--app-focus-*`). `index.css` (разом зі стилями
Mantine) імпортує кореневий `app/layout.tsx`, тож він іде перед CSS компонентів, інакше Mantine перекриває власні правила. Кожен компонент імпортує свій CSS
поруч; спільні класи — `.app-cell-*`, `.app-money`, `.app-number`, `.app-section-title`, `.app-filter-*`,
`.app-screen-tab*`. Випадні списки Mantine рендеряться в портал, тож стилізуються через `classNames` / `comboboxProps`.
Лінивий чанк сторінки несе власний CSS: на CSS іншої сторінки покладатися не можна.

### 15.8. Що змінилося для працівників

- Бічну панель замінила шапка у два ряди: розділи вгорі, вкладки розділу під ними.
- Дзвоника зі сповіщеннями немає: нові замовлення, заявки й невиконані операції видно в бейджах меню і на «Огляді».
- Форми розділів, добірок, точок самовивозу й напрямків послуг, а також запис журналу відкриваються в шухляді праворуч.
- Свій пароль змінюють у меню облікового запису (або кнопкою «Змінити мій пароль» на сторінці «Працівники»).
- Дві фіксовані ролі замінено ролями з правами за ключами; нова сторінка «Ролі і права» (`docs/console-guide.md`).
- Після нового релізу вкладка, що просить уже видалений файл сторінки, один раз перезавантажується сама
  (`ChunkLoadError` у `AppErrorBoundary` → `reloadOnStaleChunk` з `@/shared/lib/staleChunk`, не частіше ніж раз на 30 с).
- Після розширення (розділ 15.11): нове меню й адреси (старі закладки перенаправляються), «Огляд» став «Дашбордом»,
  «Розділи» — «Категоріями», «Добірки головної» — «Добірками»; контакти переїхали в «Налаштування → Магазин»,
  самовивіз — у «Налаштування → Доставка», перенаправлення — у «Сайт → SEO»; імпорт відкривається кнопкою з
  «Товарів» чи «Інтеграцій».

### 15.9. Збірка, Docker, розробка

- **Розробка.** `npm run dev -w console` (з `web/`) — `node dev-server.mjs`: Next.js у режимі розробки (Turbopack, HMR)
  на http://localhost:3001 (`PORT`) за власним HTTP-сервером. Вбудовані rewrites Next.js не годяться: вони замінюють
  `Host` на адресу цілі, і Caddy віддав би запит сайту вітрини. Тому `/api` проксіює сам `dev-server.mjs` на
  `API_INTERNAL_URL`, за замовчуванням `http://127.0.0.1:8080` (Caddy Docker-стека) із заголовком
  `Host: console.localhost:8080`, тож запит проходить сайтом консолі в Caddy так само, як із браузера. Інший `Host` —
  `API_HOST_HEADER`. Якщо `API_INTERNAL_URL` задано, а `API_HOST_HEADER` ні, `Host` стає адресою цілі: так консоль
  працює з API з `dotnet run` (`API_INTERNAL_URL=http://localhost:5080`). Зібрану консоль локально дивляться в
  Docker-стеку (контейнер `console`). Тестові облікові записи — `Seed:Users` в
  `src/PoliValko.Api/appsettings.Development.json` (Admin — Адміністратор, Manager — Менеджер).
- **Перевірки й збірка.** `npm run typecheck -w console` (`next typegen && tsc --noEmit`), `npm run lint -w console`
  (`eslint .`), `npm run build -w console` (`next build` зі статичним експортом → `apps/console/out`: `index.html`,
  `404.html`, `_next/static/…`, `favicon.ico`). Чанки ділить Turbopack; кожна сторінка — окремий лінивий чанк
  (`React.lazy` у `lazyConsolePages.ts`).
- **`SITE_URL`** вбудовується під час збірки: `next.config.ts` передає `env.SITE_URL` = `SITE_URL` ??
  `http://localhost:8080`, і Next.js підставляє `process.env.SITE_URL` у код. З нього `siteUrl(path)` (`@/shared/lib/siteUrl`) будує
  посилання «На сайті», адреси текстових сторінок і кнопку вітрини в шапці. Після зміни `SITE_URL` образ консолі треба
  перезібрати (`docs/operations.md`, розділ 4).
- **Docker.** Ціль `console` у `web/Dockerfile`: образ `caddy:2-alpine`, у `/srv` — `apps/console/out` з етапу
  `build` (`npm run build -w console`, `SITE_URL` з build-arg), конфігурація — `apps/console/serve.Caddyfile`: порт 3000,
  без HTTPS і API керування, стиснення `zstd`/`gzip`, `/_next/static/*` з `Cache-Control: public, max-age=31536000, immutable`,
  решта з `no-cache`, будь-який шлях без файлу → `index.html` (адресу на кшталт `/orders/PV-…` можна відкрити напряму).
- **compose.yaml.** Сервіс `console`: `target: console`, build-args `APP: console` і `SITE_URL`, healthcheck
  `wget http://127.0.0.1:3000/login` (віддає `index.html`). Змінних середовища й залежності від `api` немає: дані браузер
  бере через `/api` того самого піддомену, який основний Caddy (`deploy/Caddyfile`) веде в API, а решту — на
  `console:3000`. Staging перевизначає образ (`polivalko-staging-console`) і `SITE_URL`, production — лише `SITE_URL`
  (обов'язковий).

### 15.10. Як додати сторінку чи право

1. Сторінка — `src/features/<фіча>/pages/<Назва>Page.tsx` з іменованим експортом і лінивий імпорт у
   `app/routes/lazyConsolePages.ts`.
2. Маршрут — запис у `app/routes/consoleRoutes.ts`: `path` під префіксом свого розділу меню (`/sales`, `/catalog`,
   `/site`, `/settings`, `/system`), `title`, `permissionKey`, за потреби `alsoAllowedBy`, `page`. Якщо сторінка
   переїжджає, стара адреса — запис у `consoleRedirects`, а всі внутрішні посилання — на нову.
3. Пункт меню — у `features/navigation/lib/navigationModel.ts` з тими самими ключами (і `badge`, якщо лічильник є в
   `ConsoleSummaryDto`). Новий розділ — ще й `prefix` у моделі та в `sectionRedirects`.
4. Сторінка списку — за зразком `orders`: `ListPage` / `FilterBar` / `DataTable`, стан в URL, дії під `can` / `<Can>`.
5. Новий ключ права — спершу на сервері (`PermissionKeys`, `PermissionCatalog`, нова версія каталогу —
   `docs/architecture-backend.md`, розділ 5.2), потім той самий рядок у `PermissionKeys`, `PERMISSION_LABELS` і
   `PERMISSION_CATALOG_VERSION` консолі.
6. Імпорт з іншої фічі — лише через її `index.ts`; нове ребро — в `edges` у `eslint.config.mjs` і в розділі 15.2.
7. Перевірка з `web/`: `npm run typecheck -w console`, `npm run lint -w console`, `npm run build -w console`; після змін
   API — `npm run api:types`.

### 15.11. Розширення консолі (2026-11-05)

Меню перебудовано за дослідженням структури бек-офісів (Shopify, Хорошоп, Prom, KeyCRM, OpenCart): верхній рівень —
розділи за видом роботи, рідкісне — у «Налаштуваннях» і «Системі». Межі ТЗ збережено: власних знижок, промокодів і
редагування цін немає (ціни й стара ціна лише з Navkolo, ТЗ §4.6), статус оплати вручну не змінюється, резервів і
другого платіжного провайдера на цю дату не було. Оновлення 08.11: серверний кошик і локальні резерви описані нижче.

| Фіча | Що додано | API (`/api/v1/console/…`) |
| --- | --- | --- |
| `returns` (нова) | `ReturnsPage`: усі повернення коштів зі станом грошей і чека | `GET refunds` |
| `customers` | `CustomersPage` з вкладками «За замовленнями» (колишній список) і «Кабінети», `AccountPage` з блокуванням і листом для скидання пароля | `GET customers`, `GET accounts`, `GET accounts/{id}`, `POST accounts/{id}/lock`, `POST accounts/{id}/password-reset` |
| `orders` | `OrderNoteCard` («Нотатка для працівників»), рядок «Кабінет» у `OrderBuyerCard` (`customerAccountId`) | `PUT orders/{number}/note` |
| `dashboard` | `CatalogAttention` («Потребує уваги»: наповнення, нові, приховані з залишком) | `GET catalog/products/counts` |
| `catalog` | `ProductsTabs` (вибірки), фільтри «Бренд», «Мітка», «Наповнення», `ProductsBulkBar` + `ProductsBulkDialog` (категорія, бренд, ручні мітки), `ProductEditorLabels`, бренд у товарі зі списку; `CategoryForm` з фото, описом і фільтрами з довідника (`MultiSelect`, до 10); `AttributesPage`, `BrandsPage` (+ `BrandMergeDialog`), `LabelsPage`; «Добірки головної» → «Добірки» | `GET catalog/products` (+ `brand`, `labelId`, `fill`, `newDays`, `hiddenWithStock`), `GET catalog/products/counts`, `POST catalog/products/bulk`, `catalog/attributes`, `catalog/brands` (+ `{id}/merge`), `catalog/labels`, `POST media/images` |
| `content` | `PageSeoFields` у редакторі сторінки, фото в `ServiceDirectionDrawer` | `content/pages`, `content/services`, `POST media/images` |
| `site` (нова) | `HomeSettingsPage` (блоки, смуга оголошення, переваги, кроки, блок магазину), `BannersPage` + `BannerDrawer` (з `kicker` — «Напис над заголовком»), `SeoPage` з `RedirectsPanel` (перенесено з `catalog`) і `SeoTemplatesPanel` | `site/home`, `site/banners` (+ `PUT site/banners/order`), `site/seo-templates`, `catalog/redirects`, `POST media/images` |
| `settings` (нова) | `ShopSettingsPage` (форма контактів з колишньої `ContactsPage` + особливі дні, соцмережі з Viber, реквізити), `DeliverySettingsPage` (перемикачі способів + точки самовивозу з колишньої `PickupPage`), `PaymentSettingsPage` (лише читання), `NotificationSettingsPage` (з тестовим повідомленням) | `content/contacts`, `settings/shop`, `settings/delivery`, `delivery/pickup-points`, `settings/payments`, `settings/notifications` (+ `POST …/test`) |
| `integration` | кнопка «Імпорт каталогу з файлу» й посилання з рядка імпорту ведуть на `/catalog/import` | — |

Видалено сторінки `content/pages/ContactsPage`, `content/pages/PickupPage` і `catalog/pages/RedirectsPage`: їхні
форми живуть у `settings` і `site`. Фото категорій, брендів, банерів і напрямків послуг вантажаться через
`POST /api/v1/console/media/images` (`FormData`, той самий повтор CSRF), фото товарів — як і раніше, через
`catalog/products/{id}/images`. Форми «Головна», «Магазин» і редактор сторінки зберігаються ще й Ctrl/⌘+S; форми
«Головна», «Магазин», «Доставка», «Сповіщення» й редактор сторінки попереджають про незбережені зміни під час
закриття вкладки (`beforeunload`).

`features/audit/lib/auditLabels.ts` має назви всіх дій і типів об'єктів, які пише бекенд (зокрема `order.note_changed`,
`catalog.attribute_*`, `catalog.brand_*`, `catalog.label_*`, `site.*`, `settings.*`, `customer.*`, `media.image_uploaded`);
новий код дії бекенду треба додати туди, інакше журнал покаже його кодом.

Перевірка 2026-11-05: `npm run typecheck -w console` і `npm run lint -w console` — без помилок.

### 15.12. Збірка на Next.js (2026-11-06)

ТЗ вимагає Next.js і React для вебмагазину й адміністративного інтерфейсу, тому збирач консолі змінено з Vite на
Next.js 16.4. Застосунок лишився односторінковим (SPA) з тим самим ядром gba: React Router, Mantine, TanStack Table,
реєстр маршрутів, фічі й права. Серверного рендерингу консоль не має. Next.js будує її як статичний експорт, і Caddy
віддає його так само, як раніше віддавав `dist/`.

- **Точка входу.** Маршрути Next.js лежать у кореневій `apps/console/app/`, а не в `src/app`, бо `src/app` — каркас
  консолі. Next.js ігнорує `src/app`, коли в корені є `app/`.
  - `app/[[...slug]]/page.tsx` ловить усі адреси; `generateStaticParams` віддає лише `/`, тож експорт містить один
    `index.html`.
  - `console-client.tsx` вантажить `@/app/ConsoleRoot` через `next/dynamic` з `ssr: false`.
  - Далі адресами керує `BrowserRouter`. Caddy віддає `index.html` на будь-який шлях без файлу.
- **Що замінено.**
  - `index.html` → `app/layout.tsx` (metadata і viewport замість тегів `<meta>`, `ColorSchemeScript` Mantine).
  - `main.tsx` → `src/app/ConsoleRoot.tsx`.
  - `vite.config.ts` → `next.config.ts` і `dev-server.mjs`.
  - `import.meta.env.VITE_SITE_URL` → `process.env.SITE_URL`.
  - `vite:preloadError` → `ChunkLoadError` в `AppErrorBoundary`.
  - `eslint-plugin-react-refresh` і `typescript-eslint` → `eslint-config-next`.
  - Вивід збірки `dist/` → `out/`; кешований назавжди префікс `/assets/*` → `/_next/static/*`.
- **Розробка.** Вбудовані rewrites Next.js не годяться для `/api`: вони ставлять `Host` цілі, і Caddy віддав би
  запит сайту вітрини. Тому `dev-server.mjs` проксіює `/api` сам (розділ 15.9). `output: "export"` вмикається лише
  для збірки: у `next dev` він вимагав би перелічити всі адреси в `generateStaticParams`.
- **Перевірено 2026-11-06.**
  - `typecheck`, `lint` і `build` консолі проходять. Через правило `react/jsx-key` з `eslint-config-next` у рядки
    `NovaPoshtaPanel` додано `key`.
  - `npm run dev -w console`: сторінки й `/api` через Caddy працюють.
  - Образ у Docker: глибокі адреси, кешування, вхід, дашборд, замовлення, картка замовлення й товари працюють
    без помилок у консолі браузера.

## 16. Вітрина: дані з консолі (2026-11-05)

З розширенням консолі частина вітрини, що була зашита в коді, береться з API. Фічі, маршрути й `edges` вітрини не
змінилися; нові публічні експорти — розділ 3.2, сервер — `docs/architecture-backend.md`, розділи 5.3–5.4.

### 16.1. Звідки що береться

| Що на вітрині | Звідки | Де в коді |
| --- | --- | --- |
| Слайдер першого екрана | `GET /api/v1/site/home` → `banners` (увімкнені й у межах дат, за порядком): фото для комп'ютера й телефона, напис над заголовком (`kicker`), заголовок, текст, кнопка. Без банерів — тимчасові `heroSlides` | `home/lib/hero-slides.ts` (`bannerSlides`), `home/components/hero-slider.tsx` |
| Склад і порядок головної | `site/home` → `blocks`: невідомі й повторені ключі відкидаються, вимкнені пропускаються; без даних — усі вісім у типовому порядку. Без слайдера на сторінці лишається прихований `h1` | `home/lib/home-blocks.ts`, `home/components/home-screen.tsx` |
| Переваги, кроки, блок «Магазин у Бучі» | `site/home` → `perks`, `steps`, `visit`; порожньо — типові тексти з коду; адреса, графік і телефон блоку — з контактів | `perks.tsx`, `steps.tsx`, `store-visit.tsx` |
| Смуга оголошення | `site/home` → `announcement` (сервер віддає лише увімкнене в межах дат), посилання — `next/link` | `layout/components/announcement-bar.tsx` у `SiteHeader` |
| Добірки | усі видимі добірки з товарами за порядком: перша — лукбук-секція й стрічка, решта — стрічки (раніше лише перша) | `home/components/collection-pair.tsx` (`CollectionPairs`) |
| Знижки | лише товари в наявності зі справжньою знижкою (`discountPercent` не `null`); якщо таких немає, блок не рендериться (раніше підставлялися будь-які товари в наявності) | `home/components/offers-pair.tsx` |
| Мітки товарів | `labels` (`ProductLabelBadgeDto { name, tone }`) у плитці й на сторінці товару. На плитці перша мітка до 10 символів — стрічка в правому куті фото (`splitRibbon`), решта — чипи; у блоці покупки — чипи над назвою | `catalog/components/tile-flashes.tsx`, `product-labels.tsx`, `catalog/lib/labels.ts`, `product/components/product-buybox.tsx` |
| Фото й опис категорії | `imageUrl` і `description` у `CategoryNodeDto` / `CategoryDto`: фото — плитка, мобільне меню, `openGraph`; опис — абзаци за рядками під заголовком | `categoryPhotoUrl`, `catalog/components/category-intro.tsx`, `category-head.tsx` |
| Фото напрямків послуг | `imageUrl` у `ServiceDirectionDto` → мініатюра 72 px біля напрямку | `services/components/services-screen.tsx` |
| SEO товарів і категорій | `seoTitle` / `seoDescription` з API (порожні сервер заповнює мета-шаблоном) через `seoMetadata` (з 07.11: canonical, Open Graph, Twitter, `noindex, follow` для фільтрів, сторінки `?page=N` індексуються з власним canonical); заголовок категорії тепер теж з `seoTitle` | маршрути `product/[slug]`, `catalog/[slug]` |
| SEO текстових сторінок | `seoTitle` / `seoDescription` у `PageDto` → `pageMetadata` → `seoMetadata` | маршрути `offer`, `privacy`, `returns`, `payment-delivery` |
| Футер | реквізити продавця (`getSeller`: назва, код, адреса) замість рядка «Прототип магазину…»; соцмережі через `socialLinks` (з Viber); до трьох найближчих особливих днів | `layout/components/footer-seller.tsx`, `footer-contacts.tsx` |
| Контакти | соцмережі з Viber, особливі дні під графіком | `content/components/contacts-screen.tsx` |
| Оформлення | способи отримання з `POST /api/v1/checkout/quote` за налаштуваннями доставки: самовивіз лише коли він увімкнений і є активна точка (раніше вимкнення останньої точки давало 500 під час замовлення); `description` (зона кур'єра) і `priceNote` під назвою способу, `priceNote` — і в підсумку замість «За тарифами перевізника»; немає жодного способу — повідомлення «Зараз немає доступних способів отримання»; обраний спосіб, якого вже немає, замінюється першим доступним; помилки `delivery.method` / `payment.method` перечитують розрахунок | `checkout/hooks/use-checkout.ts`, `checkout/components/checkout-delivery.tsx`, `checkout-summary.tsx` |

### 16.2. Кеш

| Функція | `cacheLife` | `cacheTag` | Хто скидає |
| --- | --- | --- | --- |
| `getSiteHome`, `getAnnouncement` | `minutes` | `content`, `site`, `home` | збереження головної й банерів у консолі |
| `getSeller`, `getContacts` | `hours` | `content` | збереження «Магазину» (реквізити, особливі дні) і контактів |
| `getPage(slug)` | `hours` | `content`, `page:<slug>` | збереження сторінки |
| `getPickupPoints` | `hours` | `delivery` | збереження налаштувань доставки й точок |

- **Смуга оголошення — у кешованій статичній оболонці.** `AnnouncementBar` стоїть у `SiteHeader` у `Suspense` без
  `connection()`, тож її HTML збирається разом зі статичною оболонкою кожної сторінки. Найкоротший `cacheLife` в
  оболонці задає ревалідацію маршруту, тому всі попередньо зібрані сторінки (22 у `.next/prerender-manifest.json`)
  тепер мають Revalidate 1m і Expire 1h (профіль `minutes`). Це очікувана зміна таблиці `next build` (інваріант 4
  розділу 5 стосується лише позначок ○ / ◐ / ƒ).
- Головна (`HomeContent`), футер (`FooterSeller`, `FooterContacts`), контакти й блок магазину викликають
  `connection()`: вони рендеряться на кожен запит, але дані беруть із кешованих функцій вище.
- Сервер скидає теги через `/internal/revalidate` (`revalidateTag(tag, "max")`): перший запит після скидання ще може
  отримати попередній варіант, наступні — новий. Мета-шаблони, мітки, бренди й характеристики скидають `catalog`,
  `products` і `categories` / `collections`. Окремо API тримає ввімкнені банери в пам'яті 1 хв, а налаштування — 30 с
  (`ISettingsStore`), тож працівнику кажемо «протягом хвилини».

### 16.3. CSS

Три нові сегменти: `layout/styles/announce.css` (одразу після `layout.css` пакета, перед `header.css`),
`catalog/styles/labels.css` (після `flashes.css`) і `catalog/styles/category-intro.css` (після `listing.css`); маніфест
вітрини — 71 рядок. Тон мітки задає `data-tone` (`green`, `red`, `orange`, `blue`, `gray`, `dark`): зелений, червоний,
сірий і темний — токени вітрини, помаранчевий і синій — власні значення сегмента.


## Серверний кошик і повторне оформлення (08.11.2026)

`cart` залежить від `customer` для поточної сесії та CSRF. Джерело кошика — `/api/v1/cart/open`,
`PUT /api/v1/cart/`, `POST /api/v1/cart/checkout`. localStorage зберігає лише сигнал зміни між вкладками;
товари, ціни та ключ оформлення з нього не читаються. Запити запису й оновлення серіалізовані, відповідь
попереднього акаунта не може замінити новий стан. При конфлікті версії відображається актуальний кошик,
застарілі кількості не перезаписують його. Сесія перевіряється на сервері незалежно від localStorage-підказки.

Checkout передає UUID і ревізію кошика. Результат оформлення сервер зберігає разом із замовленням;
перезавантаження `/checkout` після втрати відповіді відновлює сторінку створеного замовлення.
До кошика не додається приватна копія контактів покупця у browser storage.

## 17. Вітрина: кути, рух і перегляд фото (10.11.2026)

Перший прохід «дорожчого» вигляду вітрини, лише для десктопа. Мобільну версію не перевіряли й навмисно не чіпали.

Токени в `packages/shared/styles/tokens.css`:

- `--radius: 10px` — єдине заокруглення для фото, карток, кнопок, полів, міток, панелей і банера. Колишні
  `--radius-sm`, `--radius-card`, `--radius-lg`, `--radius-xl` прибрано, інших значень кутів на вітрині немає.
  Винятки: круглі кнопки (`50%`), лічильник кошика (`--radius-pill`) і чекбокси фільтрів (`5px`, бо квадратик 16px
  з кутами 10px став би кружком);
- `--tile-gap: 12px` — відступ між картками товарів у сітках і стрічках та між картками переваг на головній;
- `--edge-inset` — відступ банера й великих фото головної від країв екрана;
- `--shadow-lift` — тінь картки товару при наведенні;
- `--ease-soft` — крива для плавних переходів;
- `--font-numeric: var(--font-money)` — ціни вітрини беруть JetBrains Mono з `money.css`, як і консоль.

Картка товару (`catalog/styles/tiles.css`) — окремий блок з рамкою й кутами замість спільної сітки з лініями. При
наведенні вона піднімається на 4px з тінню, фото повільно наближається. Плитка розділу (`.tile--look`) показує
зелену стрілку посередині фото лише при наведенні; на сенсорних екранах стрілки немає. Картки переваг на головній
статичні, без ефекту наведення.

`src/shared/styles/ui/motion.css` — сегмент перед `print.css`, тож маніфест закінчується `meta-list.css`,
`motion.css`, `print.css`. Він містить:

- появу блоків під час прокручування (`animation-timeline: view()`), обгорнуту в `@supports` і
  `prefers-reduced-motion: no-preference`; браузер без підтримки просто показує блоки на місці;
- легкий зсув великих фото головної під час прокручування;
- «підстрибування» лічильника кошика: у `cart-button.tsx` лічильник має `key={count}`, тож анімація повторюється
  при кожній зміні кількості.

Головний банер наближає фото активного слайда (`hero-zoom` у `home/styles/hero.css`). Кнопки стискаються при
натисканні (`scale: 0.97`).

Перегляд фото товару — `product/components/photo-viewer.tsx` і сегмент `product/styles/viewer.css` (одразу після
`product.css`). Клік по головному фото галереї відкриває `<dialog>` на весь екран: фото повністю, лічильник,
стрілки й мініатюри, якщо фото кілька, перемикання стрілками клавіатури, закриття хрестиком, Esc або кліком по тлу.
Коли мишка рухається по фото, воно збільшується в 2,5 раза в точці під курсором (`--zoom-x`, `--zoom-y` у
`transform-origin`); одразу після відкриття зум не вмикається. Для перегляду береться фото з `sizes="1600px"`, щоб
збільшення лишалося різким. Поки вікно відкрите, сторінка не прокручується (`html:has(.viewer[open])`).

Доповнення того ж дня:

- блоки з кутами не мають кольорових смужок з одного боку: активний пункт меню кабінету, `.notice`, панель
  пошуку, картка оплати й зміст документа виділені лише фоном або кольором тексту;
- лічильник кількості (`.stepper`) обрізає кнопки по своїх кутах (`overflow: hidden`), фокус кнопок малюється
  всередині;
- у сумах `.money` / `.app-money` пробіли звужено (`word-spacing: -0.32em`): у моноширинному JetBrains Mono пробіл
  такої самої ширини, як цифра, і `9 599 ₴` розпадалося на три шматки. Це діє і на вітрині, і в консолі;
- мітки товару (`.label`) і мітки на плитці (`.tile--shop .flash`) — Onest 500, 11px, великими літерами;
- картки послуг (`.svc-card`) стоять з відступом `--tile-gap` і мають ті самі кути.
