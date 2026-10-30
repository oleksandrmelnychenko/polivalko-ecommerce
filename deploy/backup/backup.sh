#!/usr/bin/env bash
# Резервні копії PostgreSQL (pg_dump -Fc) для сервісу backup у compose.yaml.
#
#   backup.sh [now] [мітка]  — дамп зараз (напр., «pre-deploy» перед оновленням) і ротація
#   backup.sh schedule       — щоденний цикл о BACKUP_TIME за часовим поясом TZ (Europe/Kyiv)
#   backup.sh check          — перевірка для healthcheck: є дамп, не старший за BACKUP_MAX_AGE_HOURS
#
# Підключення — стандартні змінні libpq: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD.
# Дамп спершу пишеться в прихований *.partial і перевіряється pg_restore --list; лише потім
# отримує остаточну назву, тож копіювання поза сервер (offsite.sh) не бачить незавершених файлів.
set -euo pipefail

export TZ="${TZ:-Europe/Kyiv}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_TIME="${BACKUP_TIME:-02:30}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-26}"
BACKUP_RETRY_MINUTES="${BACKUP_RETRY_MINUTES:-30}"
DB="${PGDATABASE:?Не задано PGDATABASE}"
SELF="${BASH_SOURCE[0]}"

log() { printf '%s [backup] %s\n' "$(date '+%F %T %Z')" "$*"; }
fail() { log "ПОМИЛКА: $*" >&2; exit 1; }

validate() {
  [[ "$BACKUP_TIME" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] \
    || fail "BACKUP_TIME має бути у форматі ГГ:ХХ, отримано «${BACKUP_TIME}»"
  [[ "$BACKUP_RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]] \
    || fail "BACKUP_RETENTION_DAYS має бути цілим числом від 1, отримано «${BACKUP_RETENTION_DAYS}»"
  [[ "$BACKUP_MAX_AGE_HOURS" =~ ^[1-9][0-9]*$ ]] || fail "BACKUP_MAX_AGE_HOURS має бути цілим числом"
  [[ "$BACKUP_RETRY_MINUTES" =~ ^[1-9][0-9]*$ ]] || fail "BACKUP_RETRY_MINUTES має бути цілим числом"
}

# Чи є дамп, новіший за вказану кількість годин.
has_dump_newer_than() {
  local hours=$1
  [[ -d "$BACKUP_DIR" ]] || return 1
  [[ -n "$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB}_*.dump" -mmin "-$((hours * 60))" -print -quit)" ]]
}

run_backup() {
  local label="${1:-}"
  if [[ -n "$label" && ! "$label" =~ ^[A-Za-z0-9-]+$ ]]; then
    fail "мітка може містити лише латинські літери, цифри й дефіс"
  fi

  mkdir -p "$BACKUP_DIR"
  local name tmp started size
  name="${DB}_$(date +%Y-%m-%d_%H%M%S)${label:+_${label}}.dump"
  tmp="${BACKUP_DIR}/.${name}.partial"
  started=$SECONDS

  log "Дамп бази ${DB} (${PGHOST:-localhost}:${PGPORT:-5432}) → ${name}"
  if ! pg_dump --format=custom --file="$tmp"; then
    rm -f "$tmp"
    fail "pg_dump завершився з помилкою"
  fi
  # Архів має читатися: pg_restore перевіряє зміст (TOC) без підключення до бази.
  if ! pg_restore --list "$tmp" >/dev/null; then
    rm -f "$tmp"
    fail "дамп не читається pg_restore, файл видалено"
  fi
  mv "$tmp" "${BACKUP_DIR}/${name}"
  size=$(du -h "${BACKUP_DIR}/${name}" | cut -f1)
  log "Готово: ${name}, ${size}, $((SECONDS - started)) с"

  apply_retention
}

# Ротація виконується лише після успішного дампу: збій ніколи не видаляє старі копії.
apply_retention() {
  local minutes=$((BACKUP_RETENTION_DAYS * 24 * 60)) file
  while IFS= read -r file; do
    rm -f -- "$file"
    log "Видалено за ротацією (старше ${BACKUP_RETENTION_DAYS} дн.): $(basename "$file")"
  done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB}_*.dump" -mmin "+${minutes}")
  # Залишки перерваних дампів.
  find "$BACKUP_DIR" -maxdepth 1 -type f -name ".*.partial" -mmin +720 -delete
}

# Epoch наступного запуску о BACKUP_TIME. Якщо час випадає на перехід на літній час
# (у Києві 03:00–03:59 останньої неділі березня), запуск зсувається на добу вперед від «зараз».
next_run() {
  local now today tomorrow
  now=$(date +%s)
  today=$(date -d "today ${BACKUP_TIME}" +%s 2>/dev/null) || today=0
  if ((today > now)); then
    echo "$today"
    return
  fi
  tomorrow=$(date -d "tomorrow ${BACKUP_TIME}" +%s 2>/dev/null) || tomorrow=$((now + 86400))
  echo "$tomorrow"
}

# Сон короткими відрізками: розклад не «з'їжджає» після зміни годинника чи призупинення хоста.
wait_until() {
  local target=$1 now left
  while now=$(date +%s) && ((now < target)); do
    left=$((target - now))
    sleep $((left < 300 ? left : 300)) &
    wait $!
  done
}

# Дамп в окремому процесі (set -e діє повністю) з повторами після збою.
attempt_backup() {
  local i
  for i in 1 2 3; do
    if bash "$SELF" now; then
      return 0
    fi
    if ((i < 3)); then
      log "Спроба ${i} з 3 невдала, повтор через ${BACKUP_RETRY_MINUTES} хв"
      sleep $((BACKUP_RETRY_MINUTES * 60)) &
      wait $!
    fi
  done
  log "ПОМИЛКА: дамп не створено після 3 спроб; наступна спроба — за розкладом" >&2
  return 1
}

schedule() {
  trap 'log "Зупинка"; exit 0' TERM INT
  log "Розклад: щодня о ${BACKUP_TIME} (${TZ}), зберігати ${BACKUP_RETENTION_DAYS} дн., каталог ${BACKUP_DIR}"
  # Після простою (сервер був вимкнений о BACKUP_TIME) — наздогнати пропущений дамп.
  if ! has_dump_newer_than 24; then
    log "Дампу за останні 24 год немає — створюю зараз"
    attempt_backup || true
  fi
  local at
  while :; do
    at=$(next_run)
    log "Наступний дамп: $(date -d "@${at}" '+%F %T %Z')"
    wait_until "$at"
    attempt_backup || true
  done
}

check() {
  if has_dump_newer_than "$BACKUP_MAX_AGE_HOURS"; then
    echo "OK: є дамп, новіший за ${BACKUP_MAX_AGE_HOURS} год"
  else
    echo "Немає дампу, новішого за ${BACKUP_MAX_AGE_HOURS} год, у ${BACKUP_DIR}" >&2
    exit 1
  fi
}

validate
case "${1:-now}" in
  now) run_backup "${2:-}" ;;
  schedule) schedule ;;
  check) check ;;
  -h | --help) sed -n '2,10p' "$SELF" | sed 's/^# \{0,1\}//' ;;
  *)
    # Скорочення: «backup.sh pre-deploy» = «backup.sh now pre-deploy».
    run_backup "$1"
    ;;
esac
