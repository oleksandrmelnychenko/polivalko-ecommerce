# Poli Valko — вітрина та консоль (Next.js)

Два застосунки Next.js 16 (App Router, Cache Components) в одному npm workspace: вітрина `apps/shop` і консоль
для працівників `apps/console` (окремий піддомен, локально `console.localhost`). Обидва рендерять сторінки й отримують дані лише через
ASP.NET Core API (`/api/v1`). Бізнес-логіки, доступу до БД і Server Actions для бізнес-операцій тут немає.
Спільний код (клієнт і типи API, хелпери, іконки, базові стилі) — пакет `packages/shared` (`@polivalko/shared`).

```bash
npm install                 # один package-lock.json на весь workspace
npm run dev -w shop         # вітрина: http://localhost:3000, API очікується на http://localhost:5080
npm run dev -w console      # консоль: http://localhost:3001
npm run api:types           # перегенерувати packages/shared/api/schema.d.ts з ../openapi/polivalko-api.json
npm run lint                # ESLint у кожному workspace
npm run typecheck           # next typegen + tsc у застосунках, tsc у пакеті
npm run build               # next build обох застосунків
```

| Змінна | Застосунок | Призначення |
|---|---|---|
| `API_INTERNAL_URL` | shop, console | Адреса API для серверного рендерингу й `/api` у `next dev` (за замовчуванням `http://localhost:5080`) |
| `SITE_URL` | shop, console | Публічна адреса вітрини: canonical, JSON-LD, sitemap; у консолі — посилання «на сайті» (вбудовується під час збірки) |
| `REVALIDATE_SECRET` | shop | Секрет для `POST /internal/revalidate` (скидання кешу за тегами) |

Будова, межі й правила — у [docs/architecture-web.md](../docs/architecture-web.md). Загальний опис проєкту — у
[README в корені](../README.md).
