const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

export type PeriodState = 'off' | 'scheduled' | 'ended' | 'live'

export function periodDay(value: string | null | undefined): string {
  if (!value) return ''
  if (DAY.test(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : isoDay(date)
}

export function periodStart(day: string): string | null {
  const parts = DAY.exec(day)
  return parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])).toISOString() : null
}

export function periodEnd(day: string): string | null {
  const parts = DAY.exec(day)
  return parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 23, 59, 59).toISOString() : null
}

export function periodState(isActive: boolean, startsAt: string | null | undefined, endsAt: string | null | undefined, now = new Date()): PeriodState {
  if (!isActive) return 'off'
  const from = periodDay(startsAt)
  const to = periodDay(endsAt)
  const today = isoDay(now)
  if (from && from > today) return 'scheduled'
  if (to && to < today) return 'ended'
  return 'live'
}

export function displayDay(day: string): string {
  const parts = DAY.exec(day)
  return parts ? `${parts[3]}.${parts[2]}.${parts[1]}` : ''
}

export function periodLabel(startsAt: string | null | undefined, endsAt: string | null | undefined): string {
  const from = displayDay(periodDay(startsAt))
  const to = displayDay(periodDay(endsAt))
  if (from && to) return `з ${from} до ${to}`
  if (from) return `з ${from}`
  if (to) return `до ${to}`
  return 'Без обмежень'
}

export function invalidPeriod(from: string, to: string): boolean {
  return Boolean(from && to && from > to)
}

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
