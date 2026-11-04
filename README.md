# Poli Valko

Інтернет-магазин товарів для дому, саду та городу: Next.js + спільний ASP.NET Core API + PostgreSQL.
Вітрина з особистим кабінетом покупця живе на основному домені, консоль для працівників — окремим застосунком на власному піддомені (`CONSOLE_ADDRESS`), про який вітрина нічого не знає.
Архітектура й обґрунтування — у [docs/solution-proposal.md](docs/solution-proposal.md), стан і план до запуску — у [docs/prototype-plan.md](docs/prototype-plan.md),
відповідність кожної вимоги ТЗ — у [docs/tz-status.md](docs/tz-status.md).
Розгортання, бекапи й моніторинг — [docs/operations.md](docs/operations.md); інтеграції — [docs/integrations.md](docs/integrations.md);
інструкція для працівників — [docs/console-guide.md](docs/console-guide.md).
Будова коду й правила меж між модулями — [docs/architecture-backend.md](docs/architecture-backend.md) (сервер)
і [docs/architecture-web.md](docs/architecture-web.md) (вітрина, кабінет і консоль).

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
    PoliValko.Console/       огляд, пошук Ctrl+K, лічильники меню, інтеграції й журнал змін для консолі
    PoliValko.Catalog/       розділи (групи Navkolo + підрозділи), товари, характеристики, варіанти, фото, SEO,
                             пошук і фільтри, добірки головної, перенаправлення, імпорт каталогу
    PoliValko.Content/       послуги й заявки, текстові сторінки, контакти
    PoliValko.Delivery/      Нова пошта (API 2.0 з нічною синхронізацією або демо-довідник), точки самовивозу
    PoliValko.Customers/     акаунти покупців: реєстрація й вхід за email і паролем, підтвердження пошти, відновлення пароля,
                             профіль, адреси доставки
    PoliValko.Ordering/      перерахунок кошика, замовлення гостей і покупців з акаунтом (НП, кур'єр, самовивіз), продавець,
                             статуси, повернення, «Мої замовлення»
    PoliValko.Payments/      спроби оплати, вебхуки з підписом, звірка, повернення на картку (тестовий провайдер, Plata by mono)
    PoliValko.Fiscal/        чеки продажу й повернення за матрицею продавця (заглушка, Checkbox)
    PoliValko.Navkolo/       заглушка клієнта Navkolo, синхронізація цін і залишків, передача замовлень, свіжість даних
    PoliValko.Identity/      працівники (ASP.NET Core Identity): вхід, ролі Admin/Manager, CSRF, керування доступами
    PoliValko.Notifications/ повідомлення менеджеру й алерти збоїв (Telegram або лог), листи покупцям (поки лог)
web/                        Next.js 16, npm workspaces:
  apps/shop/                вітрина й особистий кабінет покупця (дизайн за скілом Hallmark), домен магазину
  apps/console/             консоль для працівників, окремий застосунок на власному піддомені
  packages/shared/          @polivalko/shared: згенеровані типи й клієнт API, іконки, спільні стилі
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
cd web && npm install
npm run dev -w shop     # вітрина й кабінет: http://localhost:3000
npm run dev -w console  # консоль: http://localhost:3001
```

Запити браузера до `/api/*` обидва застосунки проксіюють до API.

## Увесь стек у Docker

```bash
cp .env.example .env
docker compose --profile app up -d --build
```

Вітрина й кабінет: http://localhost:8080, консоль: http://console.localhost:8080 (Chrome і curl самі ведуть `*.localhost` на цей комп'ютер).
Caddy на обох адресах віддає `/api/*` в API, решту — у відповідний застосунок. На адресі магазину API консолі закритий (404),
а адресу консолі задає `CONSOLE_ADDRESS` (на production — піддомен, напр. `console.example.ua`, див. [docs/operations.md](docs/operations.md)).
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
- Контракт: після змін API виконайте `dotnet build` (оновить `openapi/`) і `npm run api:types` у `web/`
  (типи потрапляють у `web/packages/shared/api/schema.d.ts`).
  CI перевіряє, що обидва файли закомічено.

## Оформлення, оплата й консоль

- `POST /api/v1/checkout/quote` перераховує кошик на сервері, а `POST /api/v1/orders` (з `Idempotency-Key`)
  створює гостьове замовлення й повертає `accessToken` для сторінки результату (`GET /api/v1/orders/{number}?token=`).
- Оплата карткою: `POST /api/v1/orders/{number}/payments` відкриває рахунок у провайдера (`Payments:Provider`:
  `Sandbox` — тестова сторінка `/pay/sandbox/…`, `Mono` — Plata by mono). Статус змінює лише перевірений вебхук
  `POST /api/v1/payments/webhooks/{provider}` або фонова звірка Worker; дублікати й старі повідомлення ігноруються.
- Повернення: `POST /api/v1/console/orders/{number}/refunds` (повне чи часткове за позиціями); чеки видає модуль фіскалізації.
- Кабінет покупця: `/api/v1/account/*` — реєстрація, вхід, профіль, адреси, обране, «Мої замовлення»; cookie `pv_customer`
  і заголовок `X-CSRF-TOKEN` (з `GET /api/v1/account/csrf`) для змінних запитів. Оформлення без акаунта працює, як і раніше;
  замовлення покупця з акаунтом прив'язується до нього, а гостьові замовлення з тим самим email — після підтвердження пошти.
- Консоль: `/api/v1/console/*`, cookie `pv_console` і заголовок `X-CSRF-TOKEN` (з `GET /api/v1/console/auth/csrf`) для змінних запитів.
  Ролі, тексти, каталог, інтеграції, журнал змін — див. [docs/console-guide.md](docs/console-guide.md).
- Працівники з `Seed:Users` створюються під час старту API в будь-якому середовищі (наявні не змінюються):
  локально — з `appsettings.Development.json`, у Docker — перший адміністратор з `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## Міграції

```bash
dotnet tool restore
dotnet ef migrations add <Назва> --project src/PoliValko.Infrastructure --startup-project src/PoliValko.Api --output-dir Persistence/Migrations
```

## Заглушки до отримання доступів

Без доступів замовника працюють заглушки з тим самим контрактом, що й справжні інтеграції:
Navkolo (`Navkolo:Mode=Stub`), оплата (`Payments:Provider=Sandbox`), ПРРО (`Fiscal:Provider=Stub`), Нова пошта (демо-довідник без ключа),
листи покупцям (`Email:Mode=Log`: посилання для підтвердження пошти й скидання пароля пишуться в лог API).
Як увімкнути справжні — [docs/integrations.md](docs/integrations.md). Що лишилося до запуску — [docs/prototype-plan.md](docs/prototype-plan.md).
