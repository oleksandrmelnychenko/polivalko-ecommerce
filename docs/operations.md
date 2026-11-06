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
| Демо-товари | так (`SEED_DEMO_DATA=true`) | ні, якщо не ввімкнути явно | ні (за замовчуванням `false`) |
| Опис API `/api/docs` | так | так | ні (за замовчуванням `false`) |
| Оплата / фіскалізація | Sandbox / Stub | Sandbox / Stub (інше — лише через `STAGING_*`) | обирається явно, без значень за замовчуванням |
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
| `worker` | фонові процеси: outbox, синхронізації, чеки, повідомлення | журнали й тривоги в Telegram |
| `web` | Next.js: вітрина й особистий кабінет покупця | healthcheck `GET /robots.txt` |
| `console` | Консоль для працівників: односторінковий застосунок (Next.js зі статичним експортом, React, Mantine), який віддає Caddy як статику на порту 3000; дані бере з API через `/api` свого піддомену (`CONSOLE_ADDRESS`) | healthcheck `GET /login` |
| `caddy` | єдиний вхід для двох адрес: HTTPS, `/api/*` і `/health/*` → API, решта → вітрина або консоль; на домені магазину API консолі закритий (404), а вітрина ніде не згадує адресу консолі | healthcheck `GET :2019/config/` (вбудований API керування Caddy) |
| `backup` | щоденний `pg_dump`, ротація, тест відновлення | healthcheck: є дамп не старший за 26 год |
| `backup-offsite` | копія дампів і фото в S3-сумісне сховище (профіль `offsite`) | healthcheck: успішне копіювання за останні ~2 год |

### Вимоги до сервера

- Linux x86_64 (migrations bundle збирається під `linux-x64`), Docker Engine 25+ з Compose 2.24+.
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
| `CONSOLE_ALLOWED_IPS` | caddy | усі | Необов'язково: IP або мережі (CIDR, через пробіл), з яких пускати в консоль; решта отримує 404. Рекомендовано для production (офіс, VPN) | ні |
| `HTTP_PORT` | caddy | `8080` (staging `8081`) | Порт HTTP локально й на staging | ні |
| `HTTP_BIND` | caddy (staging) | `127.0.0.1` | Адреса, на якій staging приймає з'єднання | ні |
| `SEARCH_INDEXING` | caddy | `index` | `noindex` додає `X-Robots-Tag: noindex, nofollow`; на staging примусово | ні |
| `REVALIDATE_SECRET` | api, worker, web | `local-revalidate-secret` | Спільний секрет скидання кешу вітрини (`/internal/revalidate`, лише внутрішня мережа). Production: обов'язкова | так |
| `GA_MEASUREMENT_ID` | web (збірка) | порожньо | Google Analytics 4 (`G-…`); вбудовується під час збірки образу. На staging не передається | ні |
| `GSC_VERIFICATION` | web (збірка) | порожньо | Код верифікації Google Search Console; вбудовується під час збірки | ні |
| `SEED_DEMO_DATA` | api | `true` (staging і production `false`) | Демо-товари під час старту API | ні |
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
| `NAVKOLO_MODE` | `Stub` | `Disabled` або `Stub` (до доступу до API Navkolo) | ні |
| `NAVKOLO_SYNC_INTERVAL` | `00:05:00` | Період синхронізації цін і залишків | ні |
| `PAYMENTS_PROVIDER` | `Sandbox` | `Sandbox` (тестова оплата) або `Mono` (Plata by mono). Production: обов'язкова | ні |
| `PAYMENTS_SANDBOX_SECRET` | `local-sandbox-secret` | Підпис тестових оплат. Production: обов'язкова (випадковий рядок) | так |
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

Листи покупцям (підтвердження пошти, скидання пароля) поки йдуть через заглушку `Email:Mode=Log`: посилання пишуться в журнал API.
До запуску кабінету для покупців потрібен поштовий провайдер — див. [integrations.md](integrations.md).

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
   openssl rand -hex 32   # окремо для POSTGRES_PASSWORD, REVALIDATE_SECRET, PAYMENTS_SANDBOX_SECRET
   ```

   У `.env` обов'язково: `COMPOSE_FILE=compose.yaml:deploy/compose.production.yaml`, `COMPOSE_PROFILES=app,offsite`,
   `APP_VERSION` (напр. `2026.11.0`), `SITE_ADDRESS`, `SITE_URL`, `CONSOLE_ADDRESS`, `POSTGRES_PASSWORD`, `REVALIDATE_SECRET`,
   `PAYMENTS_PROVIDER`, `PAYMENTS_SANDBOX_SECRET`, `FISCAL_PROVIDER`, `SEED_DEMO_DATA=false`, `EXPOSE_API_DOCS=false`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TELEGRAM_*`, `SELLER_*`, `OFFSITE_*`. Без обов'язкових змінних compose
   зупиниться з повідомленням, якої саме бракує. Пароль БД записується під час першого старту `postgres`
   і далі змінюється лише вручну (розділ 10).

4. **Збірка, міграції, запуск.**

   ```bash
   docker compose build                # образи polivalko-*:APP_VERSION
   docker compose run --rm migrate     # міграції БД окремим кроком; має завершитися кодом 0
   docker compose up -d
   docker compose ps                   # postgres, web, console, caddy, backup — healthy; api, worker — running
   ```

5. **Перевірка.** `curl -fsS https://example.ua/health/ready` повертає `Healthy`; відкрийте вітрину,
   увійдіть у консоль `https://console.example.ua/login` (адреса з `CONSOLE_ADDRESS`), оформіть тестове замовлення (у режимі Sandbox), зареєструйтеся
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
літери, цифра й спецсимвол — інакше API не стартує й пише причину в лог.

Після першого входу приберіть пароль з `.env` і перестворіть API (`docker compose up -d api`), щоб він не лишався
в змінних контейнера. Інших працівників і ролі з правами додає адміністратор у консолі (Система → Працівники,
Система → Ролі і права). Локально для тестів можна задати
`ADMIN_EMAIL=admin@polivalko.local` і будь-який пароль, що відповідає вимогам.

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
- Заголовки безпеки (HSTS, `nosniff`, `Referrer-Policy`) задає `deploy/Caddyfile`. Шлях `/internal/*` закритий ззовні.
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

У дамп БД не входять: фото з консолі (том `media`) — їх копіює `backup-offsite`; сертифікати (`caddy_data`) —
випускаються заново; файл `.env` — зберігайте його копію в менеджері паролів власника.

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

Розгорніть код і `.env` (розділ 3, кроки 1–3), запустіть `docker compose up -d postgres backup`, покладіть дамп
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
- Staging примусово працює як `Staging`, не індексується (`X-Robots-Tag: noindex`), не має GA4, за замовчуванням
  без демо-товарів (увімкнути — `SEED_DEMO_DATA=true`), з тестовою оплатою й фіскалізацією-заглушкою. Справжній
  провайдер вмикається лише окремо: `STAGING_PAYMENTS_PROVIDER=Mono` з тестовим токеном,
  `STAGING_FISCAL_PROVIDER=Checkbox` з тестовою касою.
- Доступ: staging слухає `127.0.0.1:8081` на сервері. Тестувальники відкривають його через SSH-тунель
  `ssh -L 8081:127.0.0.1:8081 user@server` → вітрина http://localhost:8081, консоль http://console.localhost:8081. Відкрити порт для всіх — `HTTP_BIND=0.0.0.0`
  лише разом з обмеженням за IP у файрволі провайдера (опубліковані Docker порти обходять ufw).
- Публічний staging з HTTPS на власному домені — на окремому невеликому сервері: там використовуйте
  production-конфігурацію (`compose.yaml:deploy/compose.production.yaml`) зі значеннями staging у `.env`:
  `APP_ENVIRONMENT=Staging`, `SEARCH_INDEXING=noindex`, `SEED_DEMO_DATA=false`, `PAYMENTS_PROVIDER=Sandbox`,
  `FISCAL_PROVIDER=Stub`, порожні `GA_MEASUREMENT_ID` і `GSC_VERIFICATION`.
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
- Статичні файли (`/_next/static`, фото) тест не завантажує: їх кешують браузер і CDN. Обмеження частоти діють
  лише на форми й вхід у консоль, тож на перегляд і перерахунок кошика не впливають.

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
- `console-client.mjs` — спільний вхід у консоль. Скрипти читають адміністратора з
  `src/PoliValko.Api/appsettings.Development.json` або зі змінних `CONSOLE_EMAIL` і `CONSOLE_PASSWORD`. Запити йдуть
  на `--base` (типово `http://127.0.0.1:8080`) із заголовком `Host` вітрини чи консолі.
- `remove-synthetic.sql` прибирає все, що додав генератор:
  - товари `syn-%`;
  - порожні синтетичні підкатегорії;
  - бренди й характеристики без товарів і без опису, логотипа, одиниці чи синонімів.

```bash
node tests/load/catalog/synthetic-catalog.mjs --count=10000
node tests/load/catalog/measure-catalog.mjs --runs=7 --json=catalog-scale.json
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < tests/load/catalog/remove-synthetic.sql
```

Лише для локального стеку чи staging: на production синтетичні товари потрапили б у вітрину й sitemap.

## 13. CI

`.github/workflows/ci.yml` на кожен push у `main` і pull request:

- `backend` — збірка .NET, перевірка закоміченого контракту OpenAPI, юніт- та інтеграційні тести (PostgreSQL у Testcontainers);
- `web` — відповідність TS-типів контракту, перевірка типів, lint і збірка обох застосунків на Next.js: вітрини (standalone) і консолі (статичний експорт);
- `deploy` — `bash -n`/`sh -n`, shellcheck і LF-закінчення скриптів `deploy/backup/`, `docker compose config` для
  локальної, staging- і production-конфігурацій, `caddy validate` для `deploy/Caddyfile`, `k6 inspect` для сценарію
  навантаження й збірка всіх образів (`docker compose --profile app build`) без публікації.

Розгортання не автоматизоване: реліз виконується вручну за розділом 4 після зеленого CI.

## 14. Чек-лист перед запуском

- [ ] Домен і HTTPS: `curl -I https://…` — 200 і HSTS; HTTP перенаправляє на HTTPS; консоль на окремому піддомені з noindex, `CONSOLE_ALLOWED_IPS` задано; `https://<домен>/api/v1/console/auth/me` — 404.
- [ ] Поштовий провайдер для листів покупцям підключено (`Email:Mode` не `Log`), лист підтвердження й скидання пароля доходять.
- [ ] `.env`: усі секрети згенеровані, `chmod 600`, копія в менеджері паролів; `ADMIN_PASSWORD` прибрано.
- [ ] `SEED_DEMO_DATA=false`, `EXPOSE_API_DOCS=false`, обрано `PAYMENTS_PROVIDER` і `FISCAL_PROVIDER`, заповнено `SELLER_*`.
- [ ] Бекапи: є щоденний дамп, копія поза сервер (дампи й `media/`), тест відновлення пройдено й записано.
- [ ] Зовнішній монітор `/health/ready` і головної; тестова тривога в Telegram дійшла.
- [ ] Навантажувальний тест на погодженій кількості відвідувачів пройдено, результат у протоколі.
- [ ] Staging розгорнуто, закрито від індексації; реліз перевірено на ньому.
- [ ] Відкат відпрацьовано: попередній `APP_VERSION` піднімається командою `docker compose up -d`.
