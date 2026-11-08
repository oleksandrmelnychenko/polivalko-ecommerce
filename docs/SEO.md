# SEO вітрини

Заготовка зроблена за зразком gba_ecommerce (`docs/SEO.md`, `src/lib/seo/metadata.ts`) і пристосована до вітрини
Poli Valko: одна мова (українська), адреси без префікса локалі, дані магазину з консолі.

## Модуль `features/seo`

`web/apps/shop/src/features/seo` — фіча без залежностей; її використовують маршрути (`app/**`) і фічі `catalog`,
`product`, `content`, `services` (ребра в `apps/shop/eslint.config.mjs`).

| Файл | Що дає |
|---|---|
| `lib/site.ts` | `SITE_NAME` («Poli Valko»), `siteUrl()` з `SITE_URL`, `absoluteUrl(path)`, `organizationId()` і `websiteId()` (`…/#organization`, `…/#website`) |
| `lib/metadata.ts` | `seoMetadata({ title, description, path, images, noIndex, exactTitle })` — метадані сторінки: заголовок через `pageTitle` (« \| Poli Valko» один раз), опис, canonical, Open Graph (siteName, `uk_UA`, url, зображення), Twitter (`summary_large_image`, якщо є зображення, інакше `summary`), `noindex, follow` за потреби; `defaultOpenGraph` для кореневого layout |
| `lib/json-ld.ts` | генератори schema.org: `breadcrumbJsonLd`, `itemListJsonLd`, `webSiteJsonLd` (з SearchAction на `/search?q=`), `organizationJsonLd` і `contactPageJsonLd` |
| `lib/opening-hours.ts` | графік з консолі («Пн–Пт 9:00–18:00, Сб 10:00–15:00») → `OpeningHoursSpecification`; особливі дні → `specialOpeningHoursSpecification` (вихідний — `00:00–00:00`). Текст, який не розібрано, у розмітку не потрапляє |
| `components/json-ld.tsx` | `<JsonLd data={…} />` — `<script type="application/ld+json">`, `<` екранується як `<` |

## Що індексується

| Сторінки | Індексація | canonical |
|---|---|---|
| Головна, `/catalog`, `/services`, `/contacts`, `/payment-delivery`, `/returns`, `/offer`, `/privacy` | так | власна адреса |
| Розділ `/catalog/{slug}` | так | `/catalog/{slug}` |
| Сторінки розділу `?page=N` (лише цей параметр) | так, заголовок «Назва, сторінка N» | `/catalog/{slug}?page=N` |
| Розділ із фільтрами, сортуванням чи `pageSize` | `noindex, follow` | `/catalog/{slug}` |
| Товар `/product/{slug}` | так | `/product/{slug}` |
| Пошук `/search?q=…` | `noindex, follow` | — |
| Кошик, оформлення, кабінет, замовлення, оплата | `noindex, nofollow` | — |
| «Автори фото» `/credits` | `noindex, follow` | — |

`robots.txt` закриває лише `/api/`, `/internal/` і приватні сторінки (кошик, оформлення, замовлення, оплата,
кабінет). Пошук і фільтри в ньому не закриті: роботу треба побачити `noindex`, інакше адреса може потрапити в
індекс без вмісту (порада з gba). Старі адреси товарів і розділів ведуть на нові одним 308-переходом
(перенаправлення з консолі, «Сайт → SEO → Перенаправлення»).

## Розмітка schema.org

| Сторінка | Типи |
|---|---|
| Головна | `Organization` + `Store` (назва, юридична назва й ІПН продавця, адреса, телефони, email, графік, особливі дні, мапа, соцмережі) і `WebSite` з пошуком |
| `/catalog` | `BreadcrumbList`, `ItemList` розділів |
| Розділ | `BreadcrumbList` (Головна → Каталог → батьківські розділи → розділ), `ItemList` товарів поточної сторінки |
| Товар | `Product` (`@id`, url, артикул, опис, фото, категорія, бренд, характеристики як `PropertyValue`) з `Offer` (ціна, валюта, наявність, `NewCondition`, продавець — організація магазину) і `BreadcrumbList` |
| Контакти | `@graph`: `Organization` + `ContactPage`; `BreadcrumbList` |
| Послуги, текстові сторінки | `BreadcrumbList` |

Дані організації беруться з API (`/api/v1/contacts`, `/api/v1/seller`), тобто з консолі: «Налаштування → Магазин»
(контакти, графік, особливі дні, соцмережі) і реквізити продавця. Порожнє поле в розмітку не потрапляє, вигаданих
значень немає.

## Звідки заголовки й описи

- Товари й розділи — `seoTitle` / `seoDescription` з API. Порожні сервер заповнює мета-шаблоном
  («Сайт → SEO → Мета-шаблони», змінні `{name}`, `{price}`, `{category}`, `{brand}`, `{shop}`); для товару без
  опису — перші 160 символів опису.
- Текстові сторінки — SEO-заголовок і опис сторінки з консолі («Сайт → Сторінки»), інакше заголовок і підзаголовок.
- Головна, каталог, контакти, послуги — тексти в маршрутах вітрини.
- Open Graph і Twitter повторюють заголовок з « | Poli Valko»; зображення — фото товару (до 4) чи розділу.

## Запуск у production

1. `SITE_URL` — публічна адреса з `https://` (з неї будуються canonical, `og:url`, sitemap, JSON-LD). Після зміни
   потрібна збірка `docker compose build web`.
2. Додати домен у Google Search Console. Для перевірки HTML-тегом задати `GSC_VERIFICATION` (у збірку вітрини
   потрапляє як `NEXT_PUBLIC_GSC_VERIFICATION`) і перезібрати `web`.
3. Подати `https://<домен>/sitemap.xml` у Search Console.
4. Перевірити кілька адрес у Search Console («Перевірка URL») і в Rich Results Test: головну, розділ, товар, контакти.
5. Прогнати скрипт перевірки (нижче) проти staging перед релізом.

## Перевірка

```bash
node tests/seo/check-seo.mjs
node tests/seo/check-seo.mjs --base=http://127.0.0.1:8081 --host=localhost:8081
```

Скрипт (Node 20+, без залежностей) бере розділ і товар із `sitemap.xml` (або `--category=`, `--product=`) і
перевіряє `robots.txt`, title, description, canonical, `og:title`/`og:url`, коректність JSON-LD і потрібні типи,
`noindex` на фільтрах, сортуванні, пошуку, кошику, оформленні й вході в кабінет. Код виходу 1, якщо щось не
пройшло.

## Що лишилось

- Зображення для соцмереж за замовчуванням (1200×630) і логотип для `Organization` — потрібні файли від магазину.
- Фото товарів у `sitemap.xml` — API sitemap віддає лише адреси й дати.
- `Offer` без `priceValidUntil`, доставки й умов повернення (`shippingDetails`, `hasMerchantReturnPolicy`) — додати,
  коли тарифи доставки й правила повернення будуть остаточні.
