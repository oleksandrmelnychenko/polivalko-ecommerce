# Poli Valko — експлуатація

Інструкція для того, хто розгортає й супроводжує магазин: середовища, змінні, розгортання й оновлення,
HTTPS, бекапи з відновленням, моніторинг, відкат, секрети, навантажувальний тест і CI.
Покриває вимоги розділів 10–11 ТЗ: HTTPS, захист секретів, окреме тестове середовище, відтворюване
розгортання Next.js, API й фонових процесів, моніторинг доступності й помилок, щоденні бекапи в окреме
сховище з тестом відновлення, навантажувальний тест і документацію для передачі.

## 1. Середовища

| | Локальне | Staging | Production |
|---|---|---|---|
| Файли compose | `compose.yaml` | `compose.yaml` + `compose.staging.yaml` | `compose.yaml` + `deploy/compose.production.yaml` |
| Проєкт compose (префікс контейнерів і томів) | `polivalko` | `polivalko-staging` | `polivalko` |
| Адреса | http://localhost:8080 | http://127.0.0.1:8081 на сервері (SSH-тунель) | https://домен (порти 80 і 443) |
| `ASPNETCORE_ENVIRONMENT` | `APP_ENVIRONMENT` (Production) | завжди `Staging` | `APP_ENVIRONMENT` (Production) |
| Демо-товари | так (`SEED_DEMO_DATA=true`) | `SEED_DEMO_DATA` за замовчуванням `false`, але заглушка Navkolo (`NAVKOLO_MODE=Stub`, значення за замовчуванням) однаково імпортує 32 демо-товари | так само, як на staging: без демо-товарів лише з `NAVKOLO_MODE=Disabled` або `DNTrade` (розділ 2) |
| Опис API `/api/docs` | так | так | ні (за замовчуванням `false`) |
| Оплата / фіскалізація | Sandbox / Stub | Sandbox / Stub (інше — лише через `STAGING_*`) | обирається явно, без значень за замовчуванням; Sandbox заборонено (`Payments__AllowSandbox=false`) |
| PostgreSQL ззовні | `127.0.0.1:5432` | `127.0.0.1:5433` | не публікується |
| Індексація пошуковиками | — | заборонена (`X-Robots-Tag: noindex`) | дозволена |
| Бекапи | сервіс `backup` (локальний том) | сервіс `backup` (свій том) | `backup` + копія поза сервер (`backup-offsite`) |

Staging і production можуть працювати на одному сервері: у них різні назви проєктів, томи, образи й порти.

### Сервіси

| Сервіс | Що робить | Перевірка стану |
|---|---|---|
| `postgres` | PostgreSQL 18, том `pgdata` | `pg_isready` (healthcheck) |
| `migrate` | EF migrations bundle: застосовує міграції й завершується | код виходу 0 |
| `api` | ASP.NET Core API, фото в томі `media` | `/health/live`, `/health/ready` через Caddy (зовнішній монітор) |
| `worker` | фонові процеси: outbox, синхронізації, звірка оплат, скасування неоплачених замовлень карткою, чеки, повідомлення | журнали й тривоги в Telegram |
| `web` | Next.js: вітрина й особистий кабінет покупця | healthcheck `GET /robots.txt` |
| `console` | Консоль для працівників: односторінковий застосунок (Next.js зі статичним експортом, React, Mantine), який віддає Caddy як статику на порту 3000; дані бере з API через `/api` свого піддомену (`CONSOLE_ADDRESS`) | healthcheck `GET /login` |
| `caddy` | єдиний вхід для двох адрес: HTTPS, `/api/*` і `/health/*` → API, решта → вітрина або консоль; на домені магазину API консолі закритий (404), а вітрина ніде не згадує адресу консолі | healthcheck `GET :2019/config/` (вбудований API керування Caddy) |
| `backup` | щоденний `pg_dump`, ротація, тест відновлення | healthcheck: є дамп не старший за 26 год |
| `backup-offsite` | копія дампів і фото в S3-сумісне сховище (профіль `offsite`) | healthcheck: успішне копіювання за останні ~2 год |

### Вимоги до сервера

- Linux x86_64 або arm64 (migrations bundle збирається під архітектуру образу: `linux-x64` чи `linux-arm64`), Docker Engine 25+ з Compose 2.24+.
- Орієнтовно від 2 vCPU, 4 ГБ RAM і 40 ГБ SSD; точний розмір підтверджує навантажувальний тест (розділ 12).
- DNS-записи домену й піддомену консолі (`CONSOLE_ADDRESS`) на IP сервера, відкриті вхідні порти 22, 80, 443 (UDP 443 — для HTTP/3).
- Синхронізація часу (NTP): від неї залежать розклад бекапів і TLS.

## 2. Змінні середовища

Усі значення задаються у файлі `.env` поруч із `compose.yaml` (шаблон — `.env.example`). Колонка «Секрет»: так —
значення не можна комітити, пересилати відкритими каналами чи показувати в скриншотах (розділ 10).
«Обов'язкова» — production-конфігурація (`deploy/compose.production.yaml`) не запуститься без значення.

### Compose і версія

| Змінна | За замовчуванням | Призначення | Секрет |
|---|---|---|---|
| `COMPOSE_FILE` | — | Набір файлів: `compose.yaml:deploy/compose.production.yaml` або `compose.yaml:compose.staging.yaml` | ні |
| `COMPOSE_PROFILES` | — | `app,offsite` на production, `app` на staging | ні |
| `APP_VERSION` | `latest` | Тег образів `polivalko-*` / `polivalko-staging-*`; основа відкату | ні |
| `APP_ENVIRONMENT` | `Production` | Середовище .NET (`Production`, `Development`); staging завжди `Staging` | ні |

### PostgreSQL

| Змінна | За замовчуванням | Призначення | Секрет |
|---|---|---|---|
| `POSTGRES_PASSWORD` | `polivalko_dev` | Пароль БД; діє під час першої ініціалізації тому. Production: обов'язкова | так |
| `POSTGRES_BIND` | `127.0.0.1` | Адреса публікації порту БД локально й на staging | ні |
| `POSTGRES_PORT` | `5432` (staging `5433`) | Порт БД на хості; на production не публікується | ні |

### Адреса, HTTPS, вітрина

| Змінна | Сервіси | За замовчуванням | Призначення | Секрет |
|---|---|---|---|---|
| `SITE_ADDRESS` | caddy | `:8080` | Домен для Caddy (`example.ua`) — сертифікат HTTPS отримується автоматично. Production: обов'язкова | ні |
| `SITE_URL` | api, worker, web, console (збірка) | `http://localhost:8080` (staging `:8081`) | Публічна адреса: повернення з оплати, вебхуки, sitemap, canonical, посилання в листах покупцям і з консолі на вітрину. Production: обов'язкова, з `https://` | ні |
| `CONSOLE_ADDRESS` | caddy | `http://console.localhost:8080` | Адреса консолі для Caddy (`console.example.ua`); сама назва піддомену не захищає (розділ 7). Сертифікат отримується автоматично, консоль завжди з `X-Robots-Tag: noindex, nofollow`. Production: обов'язкова | ні |
| `CONSOLE_ALLOWED_IPS` | caddy | усі | IP або мережі (CIDR, через пробіл), з яких пускати в консоль (офіс, VPN); решта отримує 404. Production: обов'язкова | ні |
| `HTTP_PORT` | caddy | `8080` (staging `8081`) | Порт HTTP локально й на staging | ні |
| `HTTP_BIND` | caddy (staging) | `127.0.0.1` | Адреса, на якій staging приймає з'єднання | ні |
| `SEARCH_INDEXING` | caddy | `index` | `noindex` додає `X-Robots-Tag: noindex, nofollow`; на staging примусово | ні |
| `REVALIDATE_SECRET` | api, worker, web | `local-revalidate-secret` | Спільний секрет скидання кешу вітрини (`/internal/revalidate`, лише внутрішня мережа). Production: обов'язкова | так |
| `DATA_PROTECTION_CERTIFICATE_DIR` | api, worker | `./.local/data-protection` | Каталог на сервері з сертифікатом Data Protection (`current.crt`, `current.key`); монтується в обидва контейнери лише для читання, без нього API й Worker не стартують (див. «Шифрування Data Protection і перехід на нову версію»). Production: обов'язкова, абсолютний шлях | ні (вміст каталогу — так) |
| `GA_MEASUREMENT_ID` | web (збірка) | порожньо | Зарезервовано; збір GA вимкнено до безпечної first-party інтеграції | ні |
| `GSC_VERIFICATION` | web (збірка) | порожньо | Код верифікації Google Search Console; вбудовується під час збірки | ні |
| `SEED_DEMO_DATA` | api | `true` (staging і production `false`) | Демо-товари під час старту API. На заглушку Navkolo не впливає: з `NAVKOLO_MODE=Stub` демо-товари з'являться й при `false` | ні |
| `EXPOSE_API_DOCS` | api | `true` (production `false`) | Опис OpenAPI й Scalar на `/api/docs` | ні |

Змінні API й Worker передаються в .NET як `Розділ__Ключ` (див. `x-app-env` у `compose.yaml`):
`Site__PublicUrl`, `Web__RevalidateUrl` (`http://web:3000/internal/revalidate`), `Web__RevalidateSecret` тощо.

### Перший адміністратор

| Змінна | За замовчуванням | Призначення | Секрет |
|---|---|---|---|
| `ADMIN_EMAIL` | порожньо | Email першого адміністратора (`Seed:Users:0`, роль Admin) | ні |
| `ADMIN_PASSWORD` | порожньо | Його пароль; після першого входу прибрати з `.env` | так |

### Інтеграції

| Змінна | За замовчуванням | Призначення | Секрет |
|---|---|---|---|
| `NAVKOLO_MODE` | `Stub` | `Disabled` — обмін вимкнено; `Stub` — заглушка з демо-даними; `DNTrade` — справжній API ([integrations.md](integrations.md)). `Stub` діє за замовчуванням і з production-конфігурацією: Worker імпортує 32 демо-товари (під час першого запуску й далі раз на добу) і кожні 5 хв повертає їм демо-ціни й залишки, навіть якщо `SEED_DEMO_DATA=false`. Магазин, де демо-товарів бути не повинно: `Disabled` або `DNTrade` | ні |
| `NAVKOLO_API_KEY` | порожньо | Ключ API DNTrade для режиму `DNTrade` | так |
| `NAVKOLO_STORE_ID` | порожньо | UUID складу в Navkolo; порожньо — єдиний склад визначається автоматично, якщо складів кілька — синхронізація завершується помилкою | ні |
| `NAVKOLO_CHANNEL` | `Poli-Valko` | Назва каналу, з якою сайт передає замовлення й за якою читає їхні статуси | ні |
| `NAVKOLO_ORDER_STATUS_ID` | порожньо | Числовий ID початкового статусу переданого замовлення (необов'язково) | ні |
| `NAVKOLO_CANCELLATION_STATUS_ID` | порожньо | Числовий ID статусу, який сайт ставить у Navkolo під час скасування замовлення | ні |
| `NAVKOLO_SYNC_INTERVAL` | `00:05:00` | Період синхронізації цін і залишків | ні |
| `PAYMENTS_PROVIDER` | `Sandbox` | `Sandbox` (тестова оплата), `Mono` (Plata by mono) або `Disabled`. Production: обов'язкова, лише `Mono` або `Disabled` — із `Sandbox` API й worker не стартують, бо тестова оплата дає змогу будь-кому позначити замовлення оплаченим. Оплата карткою пропонується на оформленні лише з `Mono` або `Sandbox`; з `Disabled` покупець бачить тільки післяплату й оплату під час самовивозу | ні |
| `PAYMENTS_SANDBOX_SECRET` | `local-sandbox-secret` | Підпис тестових оплат (локально й на staging). На production не використовується | так |
| `MONO_TOKEN` | порожньо | Токен Plata by mono | так |
| `STAGING_PAYMENTS_PROVIDER` | `Sandbox` | Лише staging: явне ввімкнення іншого провайдера (з тестовим токеном) | ні |
| `FISCAL_PROVIDER` | `Stub` | `Disabled`, `Stub` або `Checkbox`. Production: обов'язкова | ні |
| `CHECKBOX_LICENSE_KEY` | порожньо | Ключ ліцензії каси Checkbox | так |
| `CHECKBOX_CASHIER_LOGIN` | порожньо | Логін касира Checkbox | так |
| `CHECKBOX_CASHIER_PASSWORD` | порожньо | Пароль касира Checkbox | так |
| `STAGING_FISCAL_PROVIDER` | `Stub` | Лише staging: явне ввімкнення Checkbox (тестова каса) | ні |
| `NOVAPOSHTA_API_KEY` | порожньо | Ключ API 2.0 Нової пошти; порожньо — демо-довідник | так |
| `SELLER_NAME` | `Продавець уточнюється` | Назва продавця (оферта, чеки, листи), поки реквізити не збережено в консолі («Налаштування → Магазин») | ні |
| `SELLER_TAX_ID` | порожньо | ЄДРПОУ або РНОКПП | ні |
| `SELLER_ADDRESS` | порожньо | Адреса продавця | ні |
| `TELEGRAM_BOT_TOKEN` | порожньо | Бот для повідомлень менеджеру й тривог; порожньо — лише лог | так |
| `TELEGRAM_CHAT_ID` | порожньо | Чат або група, куди пише бот, якщо в консолі («Налаштування → Сповіщення») чатів не вказано | ні |

Після збереження в консолі («Налаштування → Навколо») режим, ключ, склад і статус скасування Navkolo беруться звідти, а не з `.env`.

Листи покупцям (підтвердження пошти, скидання пароля) поки йдуть через заглушку `Email:Mode=Log`: посилання пишуться в журнал API лише в Development; в інших середовищах журнал не містить токенів.
Іншого режиму ще немає: будь-яке інше значення `Email:Mode` зупиняє старт API й Worker. Чи доставляються листи, API повідомляє в `GET /api/v1/customer-mail` (зараз `delivers: false`).
До запуску кабінету для покупців потрібен поштовий провайдер — див. [integrations.md](integrations.md).

Неоплачені замовлення карткою скасовує завдання Worker «Скасування неоплачених замовлень» (у консолі — «Система → Інтеграції»). Кожні 15 хвилин воно шукає замовлення з оплатою карткою, які перебувають у статусі «Чекає оплати» довше за `Ordering:UnpaidCardOrderHours` годин (за замовчуванням 24; `0` вимикає завдання) і не оплачені, та скасовує їх так само, як скасування з консолі: відкритий рахунок анулюється, резерв товару звільняється (якщо замовлення вже передане в Navkolo — після підтвердження скасування там). Замовлення з післяплатою й оплатою під час самовивозу автоматично не скасовуються. Змінної немає у файлах compose: щоб змінити строк, додайте `Ordering__UnpaidCardOrderHours` в `environment` сервісу `worker` у власному override-файлі й допишіть цей файл у `COMPOSE_FILE`.

### Бекапи

| Змінна | За замовчуванням | Призначення | Секрет |
|---|---|---|---|
| `BACKUP_TIME` | `02:30` | Час щоденного дампу за Києвом. Не ставте 03:00–03:59 (перехід на літній час) | ні |
| `BACKUP_RETENTION_DAYS` | `14` | Скільки днів зберігати дампи на сервері | ні |
| `BACKUP_PATH` | `backups` | Іменований том або шлях на хості (окремий диск, мережеве сховище) | ні |
| `OFFSITE_TARGET` | порожньо | `бакет/шлях` у S3-сумісному сховищі, напр. `polivalko-backups/production` | ні |
| `OFFSITE_S3_PROVIDER` | `Other` | Провайдер для rclone: `AWS`, `Cloudflare`, `Hetzner`, `Wasabi`, `Minio`, `Other`… | ні |
| `OFFSITE_S3_ENDPOINT` | порожньо | Endpoint сховища (для не-AWS) | ні |
| `OFFSITE_S3_REGION` | порожньо | Регіон, якщо провайдер його вимагає | ні |
| `OFFSITE_S3_ACCESS_KEY_ID` | порожньо | Ключ доступу (лише запис у бакет) | так |
| `OFFSITE_S3_SECRET_ACCESS_KEY` | порожньо | Секрет ключа | так |
| `OFFSITE_INTERVAL` | `3600` | Як часто шукати нові дампи й фото, с | ні |
| `OFFSITE_RETENTION_DAYS` | порожньо | Видаляти в сховищі дампи, старші за N днів; порожньо — строк задає правило бакета | ні |

## 3. Перше розгортання (production)

1. **Сервер.** Встановіть Docker Engine з плагіном Compose, налаштуйте вхід лише за SSH-ключами, відкрийте
   порти 22, 80, 443 (TCP) і 443 (UDP). Створіть DNS-записи A (і AAAA, якщо є IPv6) домену й піддомену консолі (`CONSOLE_ADDRESS`) на IP сервера.
2. **Код.** Розгорніть потрібний реліз (тег) у каталог, напр. `/srv/polivalko`. Скрипти з `deploy/backup/`
   мають бути з LF-закінченнями рядків — беріть код на Linux, а не копіюйте з Windows-checkout.
3. **Налаштування.**

   ```bash
   cd /srv/polivalko
   cp .env.example .env && chmod 600 .env
   openssl rand -hex 32   # окремо для POSTGRES_PASSWORD і REVALIDATE_SECRET
   # сертифікат Data Protection: приватний каталог поза репозиторієм і поза бекапами БД
   sh deploy/create-key-certificate.sh /srv/polivalko-keys/data-protection
   ```

   Каталог сертифіката і файли `current.crt`, `current.key` має читати UID 1654 (користувач контейнерів API й Worker):
   налаштуйте власника або ACL, не відкриваючи ключ усім. Абсолютний шлях запишіть у `DATA_PROTECTION_CERTIFICATE_DIR`
   і збережіть копію каталогу окремо від дампів БД (розділ 8.1).

   У `.env` обов'язково: `COMPOSE_FILE=compose.yaml:deploy/compose.production.yaml`, `COMPOSE_PROFILES=app,offsite`,
   `APP_VERSION` (напр. `2026.11.0`), `SITE_ADDRESS`, `SITE_URL`, `CONSOLE_ADDRESS`, `CONSOLE_ALLOWED_IPS`,
   `DATA_PROTECTION_CERTIFICATE_DIR`, `POSTGRES_PASSWORD`, `REVALIDATE_SECRET`,
   `PAYMENTS_PROVIDER` (`Mono` з `MONO_TOKEN` або `Disabled`), `FISCAL_PROVIDER`, `SEED_DEMO_DATA=false`, `EXPOSE_API_DOCS=false`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TELEGRAM_*`, `SELLER_*`, `OFFSITE_*`. Без обов'язкових змінних compose
   зупиниться з повідомленням, якої саме бракує. `NAVKOLO_MODE` compose не перевіряє: якщо її не задати, діє `Stub`
   і в магазині з'являться демо-товари — задайте `Disabled` або `DNTrade` (розділ 2). Пароль БД записується під час
   першого старту `postgres` і далі змінюється лише вручну (розділ 10).

4. **Збірка, міграції, запуск.**

   ```bash
   docker compose build                # образи polivalko-*:APP_VERSION
   docker compose run --rm migrate     # міграції БД окремим кроком; має завершитися кодом 0
   docker compose up -d
   docker compose ps                   # postgres, web, console, caddy, backup — healthy; api, worker — running
   ```

5. **Перевірка.** `curl -fsS https://example.ua/health/ready` повертає `Healthy`; відкрийте вітрину,
   увійдіть у консоль `https://console.example.ua/login` (адреса з `CONSOLE_ADDRESS`), оформіть тестове замовлення з оплатою під час отримання (оплату карткою перевіряють на staging), зареєструйтеся
   в кабінеті покупця й перевірте, що замовлення з'явилося в «Моїх замовленнях».
6. **Адміністратор.** Після першого входу приберіть `ADMIN_PASSWORD` з `.env` і виконайте `docker compose up -d api`.
7. **Бекапи.** Переконайтеся, що з'явився перший дамп і копія поза сервер, і проведіть тест відновлення (розділ 8.5).
8. **Моніторинг.** Підключіть зовнішній монітор і перевірте тривоги Telegram (розділ 9).

## 4. Оновлення

```bash
cd /srv/polivalko
# 1. Код потрібного релізу (тег) і нова версія образів у .env, напр. APP_VERSION=2026.11.1.
#    Запишіть попереднє значення APP_VERSION — воно знадобиться для відкату.
# 2. Збірка нових образів; поточні контейнери працюють далі.
docker compose build
# 3. Дамп перед міграціями.
docker compose exec backup bash /opt/backup/backup.sh pre-deploy
# 4. Міграції окремим кроком: якщо вони впадуть, стара версія продовжить працювати.
docker compose run --rm migrate
# 5. Перемикання: compose перестворює лише змінені сервіси (перерва — секунди).
docker compose up -d
# 6. Перевірка.
docker compose ps
curl -fsS https://example.ua/health/ready
docker compose logs --since 10m api worker | grep -iE "fail|error|exception" || true
```

Міграції мають бути зворотно сумісними з попередньою версією коду (спершу додати, потім прибрати в наступному
релізі): тоді відкат коду не вимагає відновлення бази. Змінні `GA_MEASUREMENT_ID` і `GSC_VERIFICATION`
вбудовуються під час збірки — після їх зміни потрібен `docker compose build web`. `SITE_URL` вбудовується й у консоль:
після його зміни — `docker compose build web console`.

Консоль — статичні файли з хешем версії в іменах (`index.html` не кешується, `/_next/static/*` кешуються назавжди), тож після
оновлення працівникам достатньо перезавантажити сторінку; вкладка, що звернулася до файлу попередньої версії,
перезавантажиться сама.

## 5. Відкат

Після ввімкнення шифрування Data Protection старий API без підтримки сертифікатів не прочитає key ring. Для такого переходу звичайний відкат лише коду непридатний: зберігайте сумісну версію з certificate decryption. Деталі першого переходу й ротації наведені в розділі «Шифрування Data Protection і перехід на нову версію».

**Лише код (міграції сумісні).** Поверніть у `.env` попереднє `APP_VERSION` і виконайте

```bash
docker compose up -d        # без build: використовуються вже зібрані образи попередньої версії
```

Попередні образи мають лишатися на сервері: не виконуйте `docker image prune -a`, видаляйте вручну лише версії,
старші за дві-три останні (`docker image ls --filter 'reference=polivalko-*'`). Не запускайте під час відкату `docker compose build`
чи `up --build` — це перезбере тег із поточного коду. `docker compose pull` використовуйте лише з `--ignore-buildable`.

**Код і база (несумісна міграція або пошкоджені дані).**

```bash
docker compose stop api worker
docker compose run --rm backup bash /opt/backup/restore.sh <дамп_pre-deploy>
# APP_VERSION у .env — попередня версія
docker compose up -d
```

Замовлення й заявки, створені між дампом і відкатом, у відновлену базу не потраплять: звірте їх за повідомленнями
в Telegram і кабінетами платіжного провайдера та Checkbox. Попередня база лишається як `polivalko_before_restore_<час>`.

**Конфігурація** (`compose.yaml`, `Caddyfile`, `.env`): поверніть файли попереднього релізу й виконайте `docker compose up -d`.

## 6. Перший адміністратор

Під час старту API створює працівника з `ADMIN_EMAIL` і `ADMIN_PASSWORD` з роллю Admin, якщо такого email ще немає.
Неповний запис (немає email чи пароля) пропускається з попередженням у лозі; наявних користувачів API не змінює,
тож зміна `ADMIN_PASSWORD` пізніше не змінить пароль. Вимоги до пароля: щонайменше 10 символів, великі й малі
літери, цифра й спецсимвол — інакше адміністратор не створюється: API пише причину в лог
(`Seed:Users: працівника … не створено`) і стартує далі без нього. Виправте пароль у `.env` і виконайте
`docker compose up -d api`.

Після першого входу приберіть пароль з `.env` і перестворіть API (`docker compose up -d api`), щоб він не лишався
в змінних контейнера. Інших працівників і ролі з правами додає адміністратор у консолі (Система → Працівники,
Система → Ролі і права). Локально для тестів можна задати
`ADMIN_EMAIL=admin@polivalko.local` і будь-який пароль, що відповідає вимогам.

Одразу після першого входу адміністратор вмикає двофакторну перевірку (меню профілю → «Двофакторна перевірка»): без
неї консоль не дасть створити інших адміністраторів чи призначити цю роль. Резервні коди зберігають окремо від
телефону. Працівнику, що втратив телефон і коди, перевірку скидає адміністратор на сторінці «Працівники».

Якщо доступ втратив єдиний адміністратор, перевірку вимикають у базі, після чого він входить лише з паролем і
налаштовує її заново (сесії завершаться за хвилину через новий security stamp):

```bash
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
with u as (
  update identity.users
     set two_factor_enabled = false, security_stamp = gen_random_uuid()::text, access_failed_count = 0, lockout_end = null
   where normalized_email = upper('admin@example.ua')
  returning id)
delete from identity.user_tokens t using u
 where t.user_id = u.id and t.login_provider = '[AspNetUserStore]' and t.name in ('AuthenticatorKey', 'RecoveryCodes');
SQL
```

## 7. HTTPS і домен

- `SITE_ADDRESS=example.ua` — Caddy сам отримує й поновлює сертифікат (Let's Encrypt / ZeroSSL), перенаправляє
  HTTP на HTTPS і вмикає HTTP/3. Кілька імен — через кому: `SITE_ADDRESS=example.ua, www.example.ua`
  (canonical на сторінках веде на `SITE_URL`).
- `SITE_URL=https://example.ua` — та сама адреса, яку бачать покупці; її використовують посилання оплати й sitemap.
- `CONSOLE_ADDRESS=console.example.ua` — окремий сайт консолі з власним сертифікатом на піддомені. Вітрина його не згадує:
  на домені магазину немає ні посилань, ні переадресації на консоль, а API консолі (`/api/v1/console/*`) відповідає 404.
  Консоль має інше походження, ніж вітрина: її cookie `pv_console` недоступна сторінкам магазину.
- Назва піддомену — не захист: публічні сертифікати потрапляють у журнали Certificate Transparency (crt.sh), тож
  адресу можна знайти. Справжній захист — паролі й блокування спроб входу, а для production ще й `CONSOLE_ALLOWED_IPS`
  (лише IP офісу чи VPN; решта бачить 404). Якщо сервер за Cloudflare чи іншим проксі, Caddy бачить IP проксі —
  тоді обмеження треба налаштовувати з `trusted_proxies`.
- Сертифікати зберігаються в томі `caddy_data`. Не видаляйте його: часті повторні випуски впираються в ліміти CA.
- Заголовки безпеки (HSTS, `nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN` і
  `Content-Security-Policy: frame-ancestors 'self'`) задає `deploy/Caddyfile` для вітрини й консолі. Шлях `/internal/*` закритий ззовні.
- Перевірка: `curl -I https://example.ua` (статус 200, заголовок `strict-transport-security`),
  `curl -I http://example.ua` (перенаправлення 308 на HTTPS), `curl -I https://console.example.ua/login`
  (200 і `x-robots-tag: noindex, nofollow`).

## 8. Резервні копії

### 8.1. Що й коли

- Сервіс `backup` щодня о `BACKUP_TIME` (за Києвом) робить `pg_dump -Fc` бази `polivalko`, перевіряє, що архів
  читається (`pg_restore --list`), і зберігає `polivalko_РРРР-ММ-ДД_ГГХХСС.dump`.
- Ротація: на сервері лишаються дампи за останні `BACKUP_RETENTION_DAYS` днів (14 за замовчуванням, погоджується
  з замовником). Старі копії видаляються лише після успішного нового дампу.
- Якщо сервер був вимкнений у час бекапу, пропущений дамп робиться одразу після старту. Невдалий дамп
  повторюється тричі з інтервалом 30 хв; сервіс стає `unhealthy`, якщо свіжого дампу немає понад 26 год.
- Дамп вручну: `docker compose exec backup bash /opt/backup/backup.sh` (або з міткою: `... backup.sh pre-deploy`).
- Де лежать: том `polivalko_backups` (`docker compose exec backup ls -lh /backups`) або каталог `BACKUP_PATH`.
  Забрати файл на свій комп'ютер: `docker compose cp backup:/backups/<файл> .`

У дамп БД не входять: фото з консолі (том `media`) — їх копіює `backup-offsite`; сертифікати HTTPS (`caddy_data`) —
випускаються заново; файл `.env` — зберігайте його копію в менеджері паролів власника; каталог сертифіката
Data Protection (`DATA_PROTECTION_CERTIFICATE_DIR`) — його не копіює ні `backup`, ні `backup-offsite`, тож зберігайте
копію самі, окремо від дампів: без нього API й Worker на відновленій базі не стартують.

### 8.2. Копія поза сервер (обов'язково для production)

Локальний том на тому самому диску не захищає від втрати сервера, тому на production увімкніть `backup-offsite`:

1. Створіть бакет у S3-сумісному сховищі іншого провайдера або хоча б іншого акаунта (Cloudflare R2, Backblaze B2,
   Hetzner Object Storage, AWS S3 тощо), бажано в ЄС.
2. Створіть ключ лише з правом запису в цей бакет. Увімкніть версіонування або Object Lock і правило життєвого
   циклу (напр. видаляти об'єкти, старші за 30–90 днів, — строк погоджується з замовником).
3. У `.env`: `COMPOSE_PROFILES=app,offsite`, `OFFSITE_TARGET=<бакет>/production`, `OFFSITE_S3_PROVIDER`,
   `OFFSITE_S3_ENDPOINT`, `OFFSITE_S3_REGION` (якщо потрібно), `OFFSITE_S3_ACCESS_KEY_ID`, `OFFSITE_S3_SECRET_ACCESS_KEY`.
4. `docker compose up -d` і перевірка: `docker compose logs backup-offsite` — рядки `Copied (new)`, у бакеті
   з'явилися дампи й папка `media/`.

Сервіс щогодини (`OFFSITE_INTERVAL`) докопіює нові дампи й фото; наявні файли в сховищі не перезаписуються.
Якщо правило життєвого циклу задати не можна, `OFFSITE_RETENTION_DAYS` видалятиме старі дампи самим rclone
(тоді ключу потрібне право на видалення).

### 8.3. Відновлення робочої бази

```bash
docker compose stop api worker
docker compose run --rm backup bash /opt/backup/restore.sh latest      # або назва файлу в /backups
docker compose up -d
```

Скрипт показує дамп і кількість активних підключень, просить ввести назву бази для підтвердження, відновлює дамп
у нову базу, перевіряє історію міграцій і лише потім міняє бази місцями. Попередня база лишається як
`polivalko_before_restore_<час>`; коли все перевірено, видаліть її:
`docker compose exec postgres psql -U polivalko -d postgres -c 'DROP DATABASE "polivalko_before_restore_<час>"'`.

Дамп із копії поза сервер спершу покладіть у том: `docker compose cp ./polivalko_….dump backup:/backups/`.

### 8.4. Відновлення на новому сервері

Розгорніть код і `.env` (розділ 3, кроки 1–3) і поверніть збережену копію каталогу сертифіката Data Protection
у шлях із `DATA_PROTECTION_CERTIFICATE_DIR` — новий сертифікат не створюйте: ключі у відновленій базі зашифровані
старим, без нього API й Worker не стартують. Запустіть `docker compose up -d postgres backup`, покладіть дамп
у `/backups` (`docker compose cp`), виконайте `restore.sh`, потім `docker compose run --rm migrate` і
`docker compose up -d`. Фото поверніть з папки `media/` бакета в том `polivalko_media`
(напр., `rclone copy` з тими самими ключами).

### 8.5. Тест відновлення (обов'язковий перед запуском)

```bash
docker compose exec backup bash /opt/backup/restore-test.sh             # найновіший дамп
docker compose exec backup bash /opt/backup/restore-test.sh <файл>      # конкретний, напр. скачаний зі сховища
```

Скрипт відновлює дамп у тимчасову базу на тому самому сервері PostgreSQL, рахує рядки в `catalog.products`,
`ordering.orders` і `integration.__ef_migrations_history`, показує останню міграцію й порівняння з робочою базою,
після чого видаляє тимчасову базу. Робоча база не змінюється; потрібне вільне місце приблизно як її розмір.
Результат дописується в `/backups/restore-tests.log`.

Тест обов'язковий перед запуском (результат — у протокол приймання за розділом 11), далі — щомісяця й після
будь-яких змін у бекапах. Раз на квартал перевіряйте й дамп, скачаний з копії поза сервер.

## 9. Моніторинг

- **Перевірки стану API** (через Caddy):
  `GET /health/live` — процес API відповідає (без звернення до БД);
  `GET /health/ready` — API бачить базу: `200 Healthy` або `503 Unhealthy`.
- **Зовнішній монітор доступності** (UptimeRobot, Better Stack, Uptime Kuma на іншому сервері тощо) — ззовні,
  не з того самого сервера: `https://example.ua/health/ready` кожні 1–5 хв (очікувати `Healthy`), головна сторінка `/`
  (перевіряє Next.js разом з API), `https://console.example.ua/login` (консоль; це статичні файли, тож перевіряє лише
  Caddy й контейнер `console`, а API — `/health/ready`), строк дії обох сертифікатів. Сповіщення — відповідальному за email і Telegram.
- **Стан контейнерів:** `docker compose ps`. Healthcheck є в `postgres`, `web`, `console`, `caddy`, `backup`, `backup-offsite`;
  образи .NET не містять curl/wget, тож `api` перевіряє зовнішній монітор, а `worker` — журнали й тривоги.
  Довгоживучі сервіси мають `restart: unless-stopped` і піднімаються після перезавантаження сервера.
- **Журнали:** `docker compose logs -f --since 1h api worker`, пошук помилок:
  `docker compose logs --since 24h api worker | grep -iE "fail|error|exception"`. Ротація — 5 файлів по 10 МБ на контейнер.
- **Тривоги в Telegram:** з `TELEGRAM_BOT_TOKEN` застосунок надсилає в чати з «Налаштування → Сповіщення» (або в
  `TELEGRAM_CHAT_ID`, якщо там порожньо) нові замовлення й заявки, а також тривоги про збої інтеграцій (синхронізація
  з Navkolo, оплата, фіскалізація, Нова пошта, вичерпані повтори outbox). Без токена повідомлення лише пишуться в
  журнал. Бот створюється в @BotFather,
  додається в робочу групу; ID групи можна дізнатися через `https://api.telegram.org/bot<токен>/getUpdates`.
- **Ресурси:** `df -h`, `docker system df`, `docker stats` — місце на диску для бази, бекапів і журналів.

Щодня: тривоги в Telegram і зовнішньому моніторі. Щотижня: `docker compose ps` (усе `healthy`), наявність
свіжих дампів і копій у бакеті, вільне місце на диску. Щомісяця: тест відновлення.

## 10. Секрети

- Секрети (див. колонку «Секрет» у розділі 2) зберігаються лише у файлі `.env` на сервері з правами `600`
  і в менеджері паролів власника. `.env` не потрапляє в git (`.gitignore`) і в образи (`.dockerignore`) —
  значення передаються контейнерам лише під час запуску.
- Значення змінних видно через `docker inspect` кожному, хто має доступ до Docker на сервері: членство в групі
  `docker` рівнозначне правам root, надавайте його лише адміністраторам.
- Доступ до сервера — лише SSH-ключі, без входу паролем; PostgreSQL на production не публікується назовні.
- `NEXT_PUBLIC_*` (GA4, Search Console) — публічні за природою, вони потрапляють у код сторінок.
- Staging має власні секрети: ніколи не використовуйте на ньому бойовий `MONO_TOKEN` чи касу Checkbox.
- Ротація: змініть значення в `.env` і виконайте `docker compose up -d` (для `REVALIDATE_SECRET` перестворюються
  api, worker і web разом). Токени провайдерів перевипускаються в їхніх кабінетах, токен бота — командою `/revoke`
  у @BotFather. Пароль БД: спершу
  `docker compose exec postgres psql -U polivalko -d postgres -c "ALTER USER polivalko PASSWORD '<новий>'"`,
  потім `.env` і `docker compose up -d`.
- Після звільнення працівника з доступом — ротація всіх секретів, до яких він мав доступ.

## 11. Staging

Staging — копія production для перевірки релізів перед запуском і для приймання змін.

- Окремий каталог, напр. `/srv/polivalko-staging`, з тим самим релізом і власним `.env`:
  `COMPOSE_FILE=compose.yaml:compose.staging.yaml`, `COMPOSE_PROFILES=app`, інші паролі й секрети.
  Команди ті самі, що в розділах 3–5; проєкт називається `polivalko-staging`, томи — `polivalko-staging_*`,
  образи — `polivalko-staging-*`.
- Staging примусово працює як `Staging`, не індексується (`X-Robots-Tag: noindex`), не має GA4, з тестовою оплатою
  й фіскалізацією-заглушкою. `SEED_DEMO_DATA` за замовчуванням `false`, але із заглушкою Navkolo (`NAVKOLO_MODE=Stub`,
  значення за замовчуванням) 32 демо-товари однаково імпортуються; без них — `NAVKOLO_MODE=Disabled`. Справжній
  провайдер вмикається лише окремо: `STAGING_PAYMENTS_PROVIDER=Mono` з тестовим токеном,
  `STAGING_FISCAL_PROVIDER=Checkbox` з тестовою касою.
- Доступ: staging слухає `127.0.0.1:8081` на сервері. Тестувальники відкривають його через SSH-тунель
  `ssh -L 8081:127.0.0.1:8081 user@server` → вітрина http://localhost:8081, консоль http://console.localhost:8081. Відкрити порт для всіх — `HTTP_BIND=0.0.0.0`
  лише разом з обмеженням за IP у файрволі провайдера (опубліковані Docker порти обходять ufw).
- Публічний staging з HTTPS на власному домені — на окремому невеликому сервері: там використовуйте
  production-конфігурацію (`compose.yaml:deploy/compose.production.yaml`) зі значеннями staging у `.env`:
  `APP_ENVIRONMENT=Staging`, `SEARCH_INDEXING=noindex`, `SEED_DEMO_DATA=false`, `PAYMENTS_PROVIDER=Mono` з тестовим
  токеном або `Disabled`, `FISCAL_PROVIDER=Stub`, порожні `GA_MEASUREMENT_ID` і `GSC_VERIFICATION`. `Sandbox` тут
  не запуститься: production-конфігурація закріплює `Payments__AllowSandbox=false`, і API з worker із ним не стартують.
- Дані з production на staging переносьте лише для тестів відновлення: у них персональні дані покупців.

Порядок релізу: тег → staging (розділ 4) → перевірка сценаріїв і, за потреби, навантажувальний тест → той самий тег на production.

## 12. Навантажувальний тест

Сценарій `tests/load/storefront.js` (k6) імітує відвідувачів: головна → категорія → пошук → товар → перерахунок
кошика (`POST /api/v1/checkout/quote`) з паузами 1–4 с між кроками. Замовлень він не створює. Категорії, товари
й пошукові слова беруться з каталогу на початку тесту, тож потрібні товари в наявності.

```bash
docker run --rm -i -v "$PWD/tests/load:/scripts:ro" \
  -e BASE_URL=https://staging.example.ua -e VUS=100 -e DURATION=10m \
  grafana/k6:1.3.0 run /scripts/storefront.js 2>&1 | tee "load-test-$(date +%F).txt"
```

| Параметр | За замовчуванням | Значення |
|---|---|---|
| `BASE_URL` | `http://localhost:8080` | Адреса сайту (через Caddy, як у покупців) |
| `VUS` | `50` | Погоджена кількість одночасних відвідувачів |
| `DURATION` | `5m` | Тривалість під повним навантаженням |
| `RAMP_UP` | `1m` | Вихід на `VUS` |
| `THINK_MIN`, `THINK_MAX` | `1`, `4` | Пауза між кроками, с |

Пороги: p95 часу відповіді сторінок < 1,5 с, p95 API < 500 мс, помилок < 1 %, успішних перевірок > 99 %.
Якщо поріг порушено, k6 завершується ненульовим кодом.

- Кількість одночасних відвідувачів погоджується з замовником (розділ 11 ТЗ) і фіксується в протоколі разом із
  підсумком k6 (файл `load-test-<дата>.txt`), конфігурацією сервера й версією (`APP_VERSION`).
- Запускайте з іншої машини, не з самого сервера. На спільному з production сервері тест staging навантажує й
  production — проводьте його до запуску або в години найменшого трафіку; під час тесту стежте за `docker stats`.
- Статичні файли (`/_next/static`, фото) тест не завантажує: їх кешують браузер і CDN.
- Обмеження частоти (на одну IP-адресу; відповідь 429). Перегляд сторінок і каталогу не обмежений. Політика «cart» —
  120 запитів на хвилину: кошик (`POST /api/v1/cart/open`, `PUT /api/v1/cart`), перерахунок
  `POST /api/v1/checkout/quote` і відкриття оплати `POST /api/v1/orders/{number}/payments`. Замовлення
  (`POST /api/v1/orders`, `POST /api/v1/cart/checkout`) — 10 за 10 хвилин. Форми (заявка на послугу, реєстрація, лист
  скидання пароля, повторний лист підтвердження, перевірка й збереження підключення Навколо в консолі) — 5 на
  хвилину. Вхід покупця, вхід працівника в консоль, підтвердження пошти, зміна й скидання пароля — 10 на хвилину.
- Перерахунок кошика входить у сценарій, а k6 з однієї машини — це одна IP-адреса. Відвідувач сценарію робить
  перерахунок приблизно раз на 12–13 с, тож понад ~25 одночасних відвідувачів частина перерахунків отримає 429 і
  порушить поріг помилок. На час тесту підніміть ліміт на staging: `RateLimiting__Cart__PermitLimit` в `environment`
  сервісу `api` у власному override-файлі (у файлах compose цієї змінної немає).

### Великий каталог

Скрипти в `tests/load/catalog/` (Node 20+, без залежностей) перевіряють сайт на каталозі, більшому за ТЗ:

- `synthetic-catalog.mjs` створює 32 підкатегорії у 8 розділах і через справжній імпорт консолі
  (`POST /api/v1/console/integration/navkolo/import`, частинами по 2 500 рядків) завантажує синтетичні товари:
  - артикули `SYN-00001…`, ідентифікатори Navkolo `syn-00001…`;
  - характеристики й бренди за типом підкатегорії, близько третини товарів — у варіантах;
  - близько 15 % зі старою ціною, близько 12 % без залишку.

  Після імпорту скрипт ставить підкатегоріям фільтри за характеристиками. Параметри: `--count=10000`,
  `--chunk=2500`, `--images=<файл рядків «Розділ|адреса фото»>`, `--dry-run` (лише згенерувати й порахувати).
- `measure-catalog.mjs` міряє відповіді: API вітрини (сторінки списку, фільтри, фасети, пошук з помилкою й за
  артикулом), сторінки Next.js, `sitemap.xml` і списки консолі. Для кожного запиту — перший виклик, медіана й
  максимум із `--runs` повторів; `--json=<файл>` зберігає результат.
- `console-client.mjs` — спільний вхід у консоль. Обліковий запис адміністратора передавайте змінними `CONSOLE_EMAIL`
  і `CONSOLE_PASSWORD`. Без них скрипт шукає `Seed:Users` у `src/PoliValko.Api/appsettings.Development.json`, де цієї
  секції вже немає, і завершується помилкою. Запити йдуть на `--base` (типово `http://127.0.0.1:8080`) із заголовком
  `Host` вітрини чи консолі.
- `remove-synthetic.sql` прибирає все, що додав генератор:
  - товари `syn-%`;
  - порожні синтетичні підкатегорії;
  - бренди й характеристики без товарів і без опису, логотипа, одиниці чи синонімів.

```bash
export CONSOLE_EMAIL=<email адміністратора> CONSOLE_PASSWORD=<його пароль>
node tests/load/catalog/synthetic-catalog.mjs --count=10000
node tests/load/catalog/measure-catalog.mjs --runs=7 --json=catalog-scale.json
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < tests/load/catalog/remove-synthetic.sql
```

Лише для локального стеку чи staging: на production синтетичні товари потрапили б у вітрину й sitemap.

## 13. CI

`.github/workflows/ci.yml` на кожен push у `main` і pull request:

- `backend` — збірка .NET, перевірка закоміченого контракту OpenAPI, юніт- та інтеграційні тести (PostgreSQL у Testcontainers);
- `web` — по черзі: `npm ci`; `npm audit --omit=dev` (відома вразливість у робочих залежностях зупиняє завдання, і наступні кроки не виконуються); відповідність TS-типів контракту; lint; перевірка типів; тести вітрини на Node (`node --test apps/shop/tests/*.test.mjs`); збірка обох застосунків на Next.js: вітрини (standalone) і консолі (статичний експорт);
- `deploy` — `bash -n`/`sh -n`, shellcheck і LF-закінчення скриптів `deploy/backup/`, `docker compose config` для
  локальної, staging- і production-конфігурацій, `caddy validate` для `deploy/Caddyfile`, `k6 inspect` для сценарію
  навантаження й збірка всіх образів (`docker compose --profile app build`) без публікації.

`.github/workflows/sync-production.yml` на кожен push у `main` (і за ручним запуском `workflow_dispatch`) переносить
зміни з `main` у production-репозиторій `oleksandrmelnychenko/polivalko` одним комітом
«Release polivalko-ecommerce at <коміт>»; каталог `.github/workflows/` не переноситься. Цей workflow запускається
окремо від CI й не чекає на його результат: коміт потрапляє в production-репозиторій, навіть якщо завдання CI впали.
Розділ 4 описує оновлення сервера з Docker Compose.

## 14. Чек-лист перед запуском

- [ ] Домен і HTTPS: `curl -I https://…` — 200 і HSTS; HTTP перенаправляє на HTTPS; консоль на окремому піддомені з noindex, `CONSOLE_ALLOWED_IPS` задано; `https://<домен>/api/v1/console/auth/me` — 404.
- [ ] Для листів покупцям реалізовано й увімкнено справжній відправник пошти: зараз існує лише `Email:Mode=Log`, який листів не надсилає, а інше значення зупиняє старт (див. [integrations.md](integrations.md)); лист підтвердження й скидання пароля доходять.
- [ ] `.env`: усі секрети згенеровані, `chmod 600`, копія в менеджері паролів; `ADMIN_PASSWORD` прибрано.
- [ ] `SEED_DEMO_DATA=false`, `EXPOSE_API_DOCS=false`, `NAVKOLO_MODE` — `DNTrade` або `Disabled` (не `Stub`: він імпортує демо-товари), обрано `PAYMENTS_PROVIDER` і `FISCAL_PROVIDER`, заповнено `SELLER_*`.
- [ ] Бекапи: є щоденний дамп, копія поза сервер (дампи й `media/`), тест відновлення пройдено й записано.
- [ ] Зовнішній монітор `/health/ready` і головної; тестова тривога в Telegram дійшла.
- [ ] Навантажувальний тест на погодженій кількості відвідувачів пройдено, результат у протоколі.
- [ ] Staging розгорнуто, закрито від індексації; реліз перевірено на ньому.
- [ ] Відкат відпрацьовано: попередній `APP_VERSION` піднімається командою `docker compose up -d`.

### Шифрування Data Protection і перехід на нову версію

API й Worker потребують RSA-сертифіката з приватним ключем **поза БД та її резервними копіями**. Підготуйте приватний каталог:

```sh
sh deploy/create-key-certificate.sh /private/path/to/data-protection
```

Для Docker задайте `DATA_PROTECTION_CERTIFICATE_DIR` абсолютним шляхом. Каталог монтується в контейнери API й Worker, read-only; його `current.crt` і `current.key` повинні читатися UID 1654 контейнера. На Linux налаштуйте власника/ACL під цей UID, не відкривайте приватний ключ усім користувачам. Скрипт створює файли з правами 600 і не перезаписує наявні. Для локального `dotnet run` у Development типовий каталог — `~/.local/share/polivalko/data-protection`; інший шлях задається `DataProtection__CertificateDirectory`. Worker підключає той самий key ring: ним він розшифровує ключ API Navkolo, збережений у консолі, тож без сертифіката теж не стартує.

Перед оновленням зупиніть старі API-репліки: вони не налаштовані читати зашифровані ключі. Застосуйте міграції, потім запустіть нові API. На старті перевіряється розшифрування всіх збережених ключів, а незашифровані записи перетворюються в транзакції зі збереженням key ID, дат і матеріалу ключів. Перепакування key ring зберігає захищені дані, але перехід 2026-11-08 окремо змінює криптографічну версію всіх сесійних cookie: покупці та працівники повинні ввійти повторно. Старі сесії відхиляються одразу, без автоматичного перенесення; нові сесії зберігаються після звичайних перезапусків. Версія сесій фіксована в SessionCookieProtection і має залишатися однаковою на всіх репліках, зокрема при відкаті. Перед переходом зупиніть усі старі API-репліки: старий код ще приймає старі cookie. CSRF не є сесією входу; після повторного входу клієнт отримує свіжий request token. Відсутній або неправильний сертифікат блокує запуск; генерація OpenAPI та EF design-time не запускають цей процес. Повернення до старого коду без налаштування certificate decryption не підтримується.

Ротація виконується у два етапи, оскільки сертифікати завантажуються лише при старті процесу. Спочатку створіть нову пару як `upcoming.crt` / `upcoming.key`, розповсюдьте її на всі репліки поряд із незмінною `current` і перезапустіть **усі** репліки. Лише після цього збережіть попередню `current` як `previous-YYYYMMDD.crt` / `previous-YYYYMMDD.key`, перейменуйте `upcoming` у `current` і виконайте наступний перезапуск. Тоді навіть процеси першого етапу вже вміють дешифрувати ключі новим сертифікатом. Альтернатива — зупинити всі API на час ротації. Усі `*.crt` з відповідними `*.key` доступні для дешифрування; нові ключі шифруються поточним сертифікатом. Не видаляйте попередні пари, доки існують ключі/резервні копії, що потребують їх. Резервуйте каталог окремо та перевіряйте відновлення разом із БД. Старі дампи/WAL можуть містити попередній відкритий матеріал: перепакування поточної таблиці не переписує архіви.

Idempotency тепер зберігає хеш автентифікованого subject (тип identity + ID). Той самий ключ/тіло повторюється лише в початковому акаунті; інший акаунт, перехід гість↔акаунт або старий запис без subject отримує `409 idempotency.owner_mismatch`. Клієнт не скидає ключ автоматично за цим кодом. Перед повторним оформленням перевірте, чи першу операцію вже виконано. Для анонімних запитів ключ разом із точним тілом залишається можливістю повтору: не публікуйте їх і генеруйте випадковий ключ для кожної нової операції.

### Повільний npm у Docker

Збирайте з `--progress=plain`, щоб бачити мережеві запити npm. Dockerfile встановлює лише workspace вибраного `APP` і спільного пакета, щоб магазин не завантажував залежності консолі. Етап `build` успадковує `deps`, без повторного копіювання всього `node_modules`. Він використовує BuildKit cache для `/root/.npm`, `--prefer-offline`, п'ять одночасних з'єднань та обмежені timeout/retry. `--no-audit` прибирає мережеву audit-операцію зі встановлення; перевірка advisories виконується окремо. Якщо з'являється `ECONNRESET`, перевірте доступ до registry.npmjs.org із контейнера та навантаження Docker VM через `docker stats --no-stream`. Не перезапускайте Docker і не видаляйте кеші/контейнери інших проєктів як спосіб виправити цю збірку.
