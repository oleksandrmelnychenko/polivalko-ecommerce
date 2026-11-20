# Poli Valko — вітрина та консоль

npm workspace із двох застосунків і спільного пакета. Обидва застосунки отримують дані лише через ASP.NET Core API
(`/api/v1`); бізнес-логіки, доступу до БД і Server Actions для бізнес-операцій тут немає.

- `apps/shop` — вітрина й особистий кабінет покупця: Next.js 16 (App Router, Cache Components), серверний рендеринг.
- `apps/console` — консоль для працівників на окремому піддомені (локально `console.localhost`): односторінковий
  застосунок на Next.js 16 зі статичним експортом (React 19, React Router 7, Mantine 9, TanStack Table 8,
  `@tabler/icons-react`, шрифт Onest з `@fontsource/onest`) на ядрі консолі GBA. Кожна сторінка вимагає право
  працівника. У Docker зібрану статику (`apps/console/out`) віддає Caddy.
- `packages/shared` (`@polivalko/shared`) — клієнт і типи API, хелпери форматування й підписів; іконки й базові стилі —
  для вітрини.

```bash
npm install                 # один package-lock.json на весь workspace
npm run dev -w shop         # вітрина: http://localhost:3000, API через Caddy на http://127.0.0.1:8080
npm run dev -w console      # консоль: http://localhost:3001, /api — через Caddy Docker-стека (http://127.0.0.1:8080)
npm run api:types           # перегенерувати packages/shared/api/schema.d.ts з ../openapi/polivalko-api.json
npm run lint                # ESLint у кожному workspace
npm run typecheck           # вітрина й консоль: next typegen + tsc --noEmit; пакет: tsc --noEmit
npm run build               # вітрина: next build; консоль: next build (статичний експорт → apps/console/out)
```

| Змінна | Застосунок | Призначення |
|---|---|---|
| `API_INTERNAL_URL` | shop, console | Спільна адреса API для вітрини й проксі консолі в режимі розробки. Типово `http://127.0.0.1:8080` (Caddy у Docker). Для API з `dotnet run` задайте обом `http://localhost:5080` |
| `API_HOST_HEADER` | console | Заголовок `Host` для проксі `/api`. Без `API_INTERNAL_URL` — `console.localhost:8080` (сайт консолі в Caddy); якщо задано лише `API_INTERNAL_URL`, `Host` не підмінюється |
| `SITE_URL` | shop, console | Публічна адреса вітрини: canonical, JSON-LD, sitemap; у консолі — посилання «На сайті» (вбудовується під час збірки) |
| `REVALIDATE_SECRET` | shop | Секрет для `POST /internal/revalidate` (скидання кешу за тегами) |

Будова, межі й правила — у [docs/architecture-web.md](../docs/architecture-web.md) (консоль — розділ 15). Загальний
опис проєкту — у [README в корені](../README.md), інструкція для працівників — у
[docs/console-guide.md](../docs/console-guide.md).
