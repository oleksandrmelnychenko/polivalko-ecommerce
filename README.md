# Poli Valko

Інтернет-магазин товарів для дому, саду та городу: Next.js + спільний ASP.NET Core API + PostgreSQL.
Архітектура й обґрунтування — у [docs/solution-proposal.md](docs/solution-proposal.md), стан і план до запуску — у [docs/prototype-plan.md](docs/prototype-plan.md),
відповідність кожної вимоги ТЗ — у [docs/tz-status.md](docs/tz-status.md).
Розгортання, бекапи й моніторинг — [docs/operations.md](docs/operations.md); інтеграції — [docs/integrations.md](docs/integrations.md);
інструкція для працівників — [docs/admin-guide.md](docs/admin-guide.md).
Будова коду й правила меж між модулями — [docs/architecture-backend.md](docs/architecture-backend.md) (сервер)
і [docs/architecture-web.md](docs/architecture-web.md) (вітрина й адмінка).

## Склад

```
src/
  PoliValko.Api/            ASP.NET Core 10, лише збирання модулів: Program.cs + Composition/ (/api/v1, OpenAPI, Problem Details, health checks)
  PoliValko.Worker/         фонові процеси: outbox, синхронізації за розкладом, звірка оплат (Program.cs + Composition/)
  PoliValko.Infrastructure/ EF Core + PostgreSQL, міграції, outbox, Idempotency-Key, журнал змін, журнал синхронізацій, фото,
                            очищення HTML, rate limiting і CORS; точка входу — PlatformModule
  PoliValko.SharedKernel/   гроші, пагінація, телефон, транслітерація (КМУ № 55)
  Modules/                  кожен модуль: <Назва>Module.cs + Contracts/ Configuration/ Domain/ Persistence/ Features/ Integrations/ Jobs/;
                            інші модулі бачать лише Contracts/, межі перевіряють архітектурні тести
    PoliValko.Admin/         огляд, пошук Ctrl+K, лічильники меню, інтеграції й журнал змін для адмінки
    PoliValko.Catalog/       розділи (групи Navkolo + підрозділи), товари, характеристики, варіанти, фото, SEO,
                             пошук і фільтри, добірки головної, перенаправлення, імпорт каталогу
    PoliValko.Content/       послуги й заявки, текстові сторінки, контакти
    PoliValko.Delivery/      Нова пошта (API 2.0 з нічною синхронізацією або демо-довідник), точки самовивозу
    PoliValko.Ordering/      перерахунок кошика, гостьові замовлення (НП, кур'єр, самовивіз), продавець, статуси, повернення
    PoliValko.Payments/      спроби оплати, вебхуки з підписом, звірка, повернення на картку (тестовий провайдер, Plata by mono)
    PoliValko.Fiscal/        чеки продажу й повернення за матрицею продавця (заглушка, Checkbox)
    PoliValko.Navkolo/       заглушка клієнта Navkolo, синхронізація цін і залишків, передача замовлень, свіжість даних
    PoliValko.Identity/      працівники (ASP.NET Core Identity): вхід, ролі Admin/Manager, CSRF, керування доступами
    PoliValko.Notifications/ повідомлення менеджеру й алерти збоїв (Telegram або лог)
web/                        Next.js 16: вітрина (дизайн за скілом Hallmark) і адмінка; src/app — тонкі маршрути,
                            src/features — фічі вітрини й адмінки, src/shared — API-клієнт, UI, стилі
.claude/skills/hallmark/    скіл Hallmark для Claude Code, встановлений локально для проєкту
tests/                      юніт- і інтеграційні тести (HTTP + PostgreSQL у Testcontainers)
openapi/                    контракт API, генерується під час збірки й комітиться
deploy/                     Dockerfile для .NET, Caddyfile, production-override, скрипти бекапу й відновлення
tests/load/                 навантажувальний сценарій k6
```

## Що потрібно

- .NET SDK 10 (версія зафіксована в `global.json`)
- Node.js 24 LTS
- Docker Desktop (PostgreSQL та інтеграційні тести)

## Локальна розробка

```bash
docker compose up -d postgres
dotnet run --project src/PoliValko.Api --launch-profile http
```

API: http://localhost:5080, документація: http://localhost:5080/api/docs.
У режимі Development API сам застосовує міграції й додає демо-товари (`appsettings.Development.json`).

```bash
dotnet run --project src/PoliValko.Worker
```

```bash
cd web && npm install && npm run dev
```

Вітрина: http://localhost:3000. Запити браузера до `/api/*` Next.js проксіює до API.

## Увесь стек у Docker

```bash
cp .env.example .env
docker compose --profile app up -d --build
```

Відкрийте http://localhost:8080. Caddy віддає `/api/*` в API, решту — у Next.js.
Міграції застосовує окремий сервіс `migrate` (EF migrations bundle) до старту API та Worker.

## Тести

```bash
dotnet test --solution PoliValko.slnx
```

Інтеграційні тести ходять в API звичайними HTTP-запитами без Next.js і перевіряють серверні
фільтри та пагінацію, формат помилок, ідемпотентність (у тому числі паралельні запити з одним ключем) і outbox з повторами.

## Угоди API

- Маршрути `/api/v1`, JSON у camelCase, числа лише як числа.
- Гроші: `{"value": "1299.00", "currency": "UAH"}` — десяткове число рядком.
- Помилки: RFC 9457 Problem Details з полями `code` і `traceId`; для валідації — ще `errors`.
- Операції, що створюють дані, вимагають заголовок `Idempotency-Key` (UUID). Повтор із тим самим ключем
  повертає збережену відповідь із заголовком `Idempotent-Replayed: true`.
- Контракт: після змін API виконайте `dotnet build` (оновить `openapi/`) і `npm run api:types` у `web/`.
  CI перевіряє, що обидва файли закомічено.

## Оформлення, оплата й адмінка

- `POST /api/v1/checkout/quote` перераховує кошик на сервері, а `POST /api/v1/orders` (з `Idempotency-Key`)
  створює гостьове замовлення й повертає `accessToken` для сторінки результату (`GET /api/v1/orders/{number}?token=`).
- Оплата карткою: `POST /api/v1/orders/{number}/payments` відкриває рахунок у провайдера (`Payments:Provider`:
  `Sandbox` — тестова сторінка `/pay/sandbox/…`, `Mono` — Plata by mono). Статус змінює лише перевірений вебхук
  `POST /api/v1/payments/webhooks/{provider}` або фонова звірка Worker; дублікати й старі повідомлення ігноруються.
- Повернення: `POST /api/v1/admin/orders/{number}/refunds` (повне чи часткове за позиціями); чеки видає модуль фіскалізації.
- Адмінка: `/api/v1/admin/*`, cookie `pv_admin` і заголовок `X-CSRF-TOKEN` (з `GET /api/v1/admin/auth/csrf`) для змінних запитів.
  Ролі, тексти, каталог, інтеграції, журнал змін — див. [docs/admin-guide.md](docs/admin-guide.md).
- Працівники з `Seed:Users` створюються під час старту API в будь-якому середовищі (наявні не змінюються):
  локально — з `appsettings.Development.json`, у Docker — перший адміністратор з `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## Міграції

```bash
dotnet tool restore
dotnet ef migrations add <Назва> --project src/PoliValko.Infrastructure --startup-project src/PoliValko.Api --output-dir Persistence/Migrations
```

## Заглушки до отримання доступів

Без доступів замовника працюють заглушки з тим самим контрактом, що й справжні інтеграції:
Navkolo (`Navkolo:Mode=Stub`), оплата (`Payments:Provider=Sandbox`), ПРРО (`Fiscal:Provider=Stub`), Нова пошта (демо-довідник без ключа).
Як увімкнути справжні — [docs/integrations.md](docs/integrations.md). Що лишилося до запуску — [docs/prototype-plan.md](docs/prototype-plan.md).
