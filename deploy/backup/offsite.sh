#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
MEDIA_DIR="${MEDIA_DIR:-/media}"
OFFSITE_INTERVAL="${OFFSITE_INTERVAL:-3600}"
OFFSITE_RETENTION_DAYS="${OFFSITE_RETENTION_DAYS:-}"
STATE="/tmp/offsite-last-success"

log() { printf '%s [offsite] %s\n' "$(date '+%F %T %Z')" "$*"; }
fail() {
  log "ПОМИЛКА: $*" >&2
  exit 1
}

[ -n "${OFFSITE_TARGET:-}" ] || fail "не задано OFFSITE_TARGET (бакет/шлях, напр. polivalko-backups/production)"
case "$OFFSITE_INTERVAL" in
  '' | *[!0-9]*) fail "OFFSITE_INTERVAL має бути кількістю секунд" ;;
esac
case "$OFFSITE_RETENTION_DAYS" in
  *[!0-9]*) fail "OFFSITE_RETENTION_DAYS має бути цілим числом днів або порожнім" ;;
esac

DEST="offsite:${OFFSITE_TARGET}"

sync_once() {
  log "Копіювання нових дампів у ${DEST}"
  set -- --include '*.dump' --max-depth 1 --immutable -v --stats 0
  if [ -n "$OFFSITE_RETENTION_DAYS" ]; then
    set -- "$@" --max-age "${OFFSITE_RETENTION_DAYS}d"
  fi
  rclone copy "$BACKUP_DIR" "$DEST" "$@" || return 1
  if [ -n "$OFFSITE_RETENTION_DAYS" ]; then
    rclone delete "$DEST" --include '*.dump' --max-depth 1 --min-age "${OFFSITE_RETENTION_DAYS}d" -v --stats 0 || return 1
  fi
  if [ -d "$MEDIA_DIR" ]; then
    rclone copy "$MEDIA_DIR" "${DEST}/media" --immutable -v --stats 0 || return 1
  fi
  touch "$STATE"
  log "Копіювання завершено"
}

check() {
  max_minutes=$((OFFSITE_INTERVAL * 2 / 60 + 5))
  if [ -n "$(find "$STATE" -mmin "-${max_minutes}" 2>/dev/null)" ]; then
    echo "OK: останнє копіювання менш ніж ${max_minutes} хв тому"
  else
    echo "Немає успішного копіювання за ${max_minutes} хв" >&2
    exit 1
  fi
}

case "${1:-loop}" in
  check) check ;;
  once) sync_once ;;
  loop)
    log "Копіювання в ${DEST} кожні ${OFFSITE_INTERVAL} с"
    while :; do
      sync_once || log "ПОМИЛКА: копіювання не вдалося, повтор через ${OFFSITE_INTERVAL} с" >&2
      sleep "$OFFSITE_INTERVAL"
    done
    ;;
  *) fail "невідома команда «$1» (loop | once | check)" ;;
esac
