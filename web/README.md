# Poli Valko — вітрина та адмінка (Next.js)

Next.js 16 (App Router, Cache Components) рендерить сторінки й отримує дані лише через
ASP.NET Core API (`/api/v1`). Бізнес-логіки, доступу до БД і Server Actions для бізнес-операцій тут немає.

```bash
npm install
npm run dev          # http://localhost:3000, API очікується на http://localhost:5080
npm run api:types    # перегенерувати типи з ../openapi/polivalko-api.json
npm run build
```

| Змінна | Призначення |
|---|---|
| `API_INTERNAL_URL` | Адреса API для серверного рендерингу (за замовчуванням `http://localhost:5080`) |
| `SITE_URL` | Публічна адреса сайту для canonical і JSON-LD |
| `REVALIDATE_SECRET` | Секрет для `POST /internal/revalidate` (скидання кешу за тегами) |

Загальний опис проєкту — у [README в корені](../README.md).
