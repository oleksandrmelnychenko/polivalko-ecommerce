#!/usr/bin/env bash
set -euo pipefail

export TZ="${TZ:-Europe/Kyiv}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RESTORE_JOBS="${RESTORE_JOBS:-2}"
DB="${PGDATABASE:?Не задано PGDATABASE}"

log() { printf '%s [restore] %s\n' "$(date '+%F %T %Z')" "$*"; }
fail() { log "ПОМИЛКА: $*" >&2; exit 1; }
usage() {
  cat <<'USAGE'
Відновлення робочої бази з дампу pg_dump -Fc. Запускається в контейнері сервісу backup:

  docker compose stop api worker
  docker compose run --rm backup bash /opt/backup/restore.sh <дамп | latest>
  docker compose up -d

Порядок: дамп відновлюється в нову базу <db>_restore_<час>, перевіряється, потім бази
міняються місцями перейменуванням. Поточна база НЕ видаляється: вона лишається як
<db>_before_restore_<час> (з вимкненими підключеннями), доки її не видалять вручну.

Параметри:
  <дамп>     шлях до файлу, назва файлу в BACKUP_DIR або «latest» (найновіший дамп)
  --yes      без інтерактивного підтвердження (для сценаріїв; використовуйте обережно)
USAGE
}

assume_yes=false
dump_arg=""
for arg in "$@"; do
  case "$arg" in
    -y | --yes) assume_yes=true ;;
    -h | --help) usage; exit 0 ;;
    -*) usage >&2; exit 2 ;;
    *)
      [[ -z "$dump_arg" ]] || { usage >&2; exit 2; }
      dump_arg="$arg"
      ;;
  esac
done
[[ -n "$dump_arg" ]] || { usage >&2; exit 2; }

resolve_dump() {
  local arg=$1
  if [[ "$arg" == "latest" ]]; then
    find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB}_*.dump" -printf '%T@ %p\n' | sort -n | tail -n 1 | cut -d' ' -f2-
  elif [[ -f "$arg" ]]; then
    echo "$arg"
  elif [[ -f "${BACKUP_DIR}/${arg}" ]]; then
    echo "${BACKUP_DIR}/${arg}"
  fi
}

dump=$(resolve_dump "$dump_arg")
[[ -n "$dump" ]] || fail "дамп «${dump_arg}» не знайдено (каталог ${BACKUP_DIR})"
pg_restore --list "$dump" >/dev/null || fail "файл ${dump} не є читабельним дампом pg_dump -Fc"

psql_admin() { psql -X -q -v ON_ERROR_STOP=1 -d postgres "$@"; }

stamp=$(date +%Y%m%d_%H%M%S)
new_db="${DB}_restore_${stamp}"
old_db="${DB}_before_restore_${stamp}"

connections=$(psql_admin -At -v db="$DB" <<'SQL'
SELECT count(*) FROM pg_stat_activity WHERE datname = :'db' AND pid <> pg_backend_pid();
SQL
)

cat <<INFO

  Дамп:          ${dump}
  Розмір, дата:  $(du -h "$dump" | cut -f1), $(date -d "@$(stat -c %Y "$dump")" '+%F %T %Z')
  Сервер:        ${PGHOST:-localhost}:${PGPORT:-5432}
  База:          ${DB} (активних підключень: ${connections})
  Після заміни:  поточна база лишиться як ${old_db}

INFO

if ((connections > 0)); then
  log "Увага: до бази ${DB} є активні підключення (${connections}). Зупиніть api і worker (docker compose stop api worker): під час заміни підключення буде розірвано, а зміни після дампу не потраплять у відновлену базу."
fi

if ! $assume_yes; then
  [[ -t 0 ]] || fail "потрібне підтвердження: запустіть інтерактивно або додайте --yes"
  read -r -p "Щоб замінити базу ${DB} даними з дампу, введіть її назву: " answer
  [[ "$answer" == "$DB" ]] || fail "підтвердження не збігається, нічого не змінено"
fi

started=$SECONDS
cleanup_new_db() {
  log "Видаляю незавершену базу ${new_db}"
  psql_admin -v db="$new_db" <<'SQL' || true
SET client_min_messages TO warning;
DROP DATABASE IF EXISTS :"db" WITH (FORCE);
SQL
}

log "Створюю базу ${new_db} і відновлюю дамп (паралельно: ${RESTORE_JOBS})"
psql_admin -v db="$new_db" <<'SQL'
CREATE DATABASE :"db" TEMPLATE template0;
SQL
if ! pg_restore --dbname="$new_db" --no-owner --no-privileges --exit-on-error --jobs="$RESTORE_JOBS" "$dump"; then
  cleanup_new_db
  fail "pg_restore завершився з помилкою; робочу базу не змінено"
fi

migrations=$(psql -X -At -v ON_ERROR_STOP=1 -d "$new_db" -c 'SELECT count(*) FROM integration.__ef_migrations_history') || migrations=""
if [[ -z "$migrations" || "$migrations" == "0" ]]; then
  cleanup_new_db
  fail "у відновленій базі немає історії міграцій EF (integration.__ef_migrations_history); робочу базу не змінено"
fi
log "Дамп відновлено за $((SECONDS - started)) с, міграцій в історії: ${migrations}"

db_exists=$(psql_admin -At -v db="$DB" <<'SQL'
SELECT count(*) FROM pg_database WHERE datname = :'db';
SQL
)
if [[ "$db_exists" == "0" ]]; then
  psql_admin -v db="$DB" -v new="$new_db" <<'SQL'
ALTER DATABASE :"new" RENAME TO :"db";
SQL
  log "Готово. Базу ${DB} створено з $(basename "$dump"). Далі: docker compose up -d"
  exit 0
fi

log "Замінюю ${DB} на відновлену копію"
if ! psql_admin -v db="$DB" -v old="$old_db" -v new="$new_db" <<'SQL'; then
ALTER DATABASE :"db" WITH ALLOW_CONNECTIONS false;
SELECT count(pg_terminate_backend(pid, 5000)) AS "розірвано підключень"
  FROM pg_stat_activity WHERE datname = :'db' AND pid <> pg_backend_pid();
ALTER DATABASE :"db" RENAME TO :"old";
ALTER DATABASE :"new" RENAME TO :"db";
SQL
  log "Заміна не вдалася. Повертаю підключення до ${DB}; відновлена копія лишилась як ${new_db}."
  psql_admin -v db="$DB" <<'SQL' || true
ALTER DATABASE :"db" WITH ALLOW_CONNECTIONS true;
SQL
  fail "перевірте стан: SELECT datname, datallowconn FROM pg_database;"
fi

log "Готово. ${DB} відновлено з $(basename "$dump"); попередня база — ${old_db}."
log "Далі: docker compose up -d, перевірка сайту й адмінки. Коли все гаразд, видаліть стару базу:"
log "  docker compose exec postgres psql -U ${PGUSER:-polivalko} -d postgres -c 'DROP DATABASE \"${old_db}\"'"
