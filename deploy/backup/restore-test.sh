#!/usr/bin/env bash
set -euo pipefail

export TZ="${TZ:-Europe/Kyiv}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RESTORE_JOBS="${RESTORE_JOBS:-2}"
DB="${PGDATABASE:?Не задано PGDATABASE}"
REPORT="${BACKUP_DIR}/restore-tests.log"

log() { printf '%s [restore-test] %s\n' "$(date '+%F %T %Z')" "$*"; }
fail() {
  log "ПОМИЛКА: $*" >&2
  record "FAIL" "$*"
  exit 1
}
record() { printf '%s\t%s\t%s\t%s\n' "$(date '+%F %T %Z')" "$1" "$(basename "${dump:-?}")" "$2" >>"$REPORT" 2>/dev/null || true; }

if [[ $# -gt 0 ]]; then
  if [[ -f "$1" ]]; then dump="$1"; else dump="${BACKUP_DIR}/$1"; fi
else
  dump=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB}_*.dump" -printf '%T@ %p\n' | sort -n | tail -n 1 | cut -d' ' -f2-)
fi
[[ -n "${dump:-}" && -f "$dump" ]] || fail "дамп не знайдено (каталог ${BACKUP_DIR})"

scratch="${DB}_restore_test_$(date +%Y%m%d_%H%M%S)"
started=$SECONDS

drop_scratch() {
  psql -X -q -d postgres -v ON_ERROR_STOP=1 -v db="$scratch" <<'SQL' || log "Не вдалося видалити ${scratch}: видаліть вручну"
SET client_min_messages TO warning;
DROP DATABASE IF EXISTS :"db" WITH (FORCE);
SQL
}
trap drop_scratch EXIT

log "Дамп: ${dump} ($(du -h "$dump" | cut -f1), $(date -d "@$(stat -c %Y "$dump")" '+%F %T %Z'))"
pg_restore --list "$dump" >/dev/null || fail "файл не читається pg_restore"

log "Відновлення в тимчасову базу ${scratch}"
psql -X -q -d postgres -v ON_ERROR_STOP=1 -v db="$scratch" <<'SQL' || fail "не вдалося створити тимчасову базу"
CREATE DATABASE :"db" TEMPLATE template0;
SQL
pg_restore --dbname="$scratch" --no-owner --no-privileges --exit-on-error --jobs="$RESTORE_JOBS" "$dump" \
  || fail "pg_restore завершився з помилкою"
restore_seconds=$((SECONDS - started))

counts_sql="SELECT
  (SELECT count(*) FROM catalog.products) AS products,
  (SELECT count(*) FROM ordering.orders) AS orders,
  (SELECT count(*) FROM integration.__ef_migrations_history) AS migrations"

restored=$(psql -X -At -F ' ' -v ON_ERROR_STOP=1 -d "$scratch" -c "$counts_sql") \
  || fail "перевірочні запити не виконались: схема у дампі неповна"
read -r products orders migrations <<<"$restored"
last_migration=$(psql -X -At -v ON_ERROR_STOP=1 -d "$scratch" \
  -c 'SELECT * FROM integration.__ef_migrations_history ORDER BY 1 DESC LIMIT 1' | cut -d'|' -f1)
live=$(psql -X -At -F ' ' -d "$DB" -c "$counts_sql" 2>/dev/null) || live="? ? ?"
read -r live_products live_orders live_migrations <<<"$live"

cat <<TABLE

  Перевірка                              у дампі   у робочій базі зараз
  catalog.products                       $(printf '%-9s' "$products") ${live_products}
  ordering.orders                        $(printf '%-9s' "$orders") ${live_orders}
  integration.__ef_migrations_history    $(printf '%-9s' "$migrations") ${live_migrations}
  Остання міграція в дампі: ${last_migration}
  Час відновлення: ${restore_seconds} с

TABLE

((migrations > 0)) || fail "історія міграцій EF порожня"
if ((products == 0)); then
  log "Увага: у дампі немає товарів. Для бази до імпорту каталогу це нормально, інакше — перевірте дамп."
fi

record "OK" "products=${products} orders=${orders} migrations=${migrations} last=${last_migration} restore=${restore_seconds}s"
log "Тестове відновлення пройдено; тимчасову базу буде видалено. Журнал: ${REPORT}"
