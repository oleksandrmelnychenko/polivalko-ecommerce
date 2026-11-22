import type { Dashboard } from '../api/dashboardApi'

export const PERIODS = [7, 30, 90] as const
export type Period = (typeof PERIODS)[number]
export const DEFAULT_PERIOD: Period = 30

export type Metric = 'revenue' | 'orders'

export function readPeriod(params: URLSearchParams): Period {
  return PERIODS.find((period) => String(period) === params.get('days')) ?? DEFAULT_PERIOD
}

export const share = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : '')

export const numberFormat = new Intl.NumberFormat('uk-UA')
export const compact = new Intl.NumberFormat('uk-UA', { notation: 'compact', maximumFractionDigits: 2 })
export const shortDate = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', timeZone: 'Europe/Kyiv' })
export const longDate = new Intl.DateTimeFormat('uk-UA', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' })
const bestDayDate = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' })

export const asDate = (day: string) => new Date(`${day}T12:00:00+03:00`)

// The axis is drawn in quarters of this maximum. These steps keep every quarter short enough for
// its label to state it exactly: a quarter of 2.5 or 5 thousand was printed as 1,3 тис. for 1 250.
export function niceMax(value: number) {
  if (value <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(value))
  return ([1, 2, 4, 6, 8, 10].find((m) => m * pow >= value) ?? 10) * pow
}

export function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

export function bestDay(data: Dashboard) {
  const best = data.byDay.reduce<Dashboard['byDay'][number] | null>((b, d) => (Number(d.revenue.value) > Number(b?.revenue.value ?? 0) ? d : b), null)
  return best ? { date: bestDayDate.format(asDate(best.date)), revenue: best.revenue } : null
}

export type DeltaValue = { kind: 'flat'; label: string } | { kind: 'up' | 'down'; good: boolean; label: string }

export function delta(current: number, previous: number, inverse = false): DeltaValue {
  if (previous === 0) return { kind: 'flat', label: current === 0 ? '0%' : 'нове' }
  // Net turnover can be negative when returns exceed sales; the sign must follow the change, not the base.
  const change = ((current - previous) / Math.abs(previous)) * 100
  const rounded = Math.abs(change) < 10 ? Math.round(change * 10) / 10 : Math.round(change)
  if (rounded === 0) return { kind: 'flat', label: '0%' }
  const good = inverse ? rounded < 0 : rounded > 0
  return { kind: rounded > 0 ? 'up' : 'down', good, label: `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toLocaleString('uk-UA')}%` }
}
