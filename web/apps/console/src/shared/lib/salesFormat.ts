import { formatPrice } from '@polivalko/shared/lib/format'

const amount = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 })
const signedPercent = new Intl.NumberFormat('uk-UA', { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 1 })
const percentage = new Intl.NumberFormat('uk-UA', { style: 'percent', maximumFractionDigits: 1 })
const fullDate = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const shortDate = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const monthName = new Intl.DateTimeFormat('uk-UA', { month: 'long', timeZone: 'UTC' })
const monthShort = new Intl.DateTimeFormat('uk-UA', { month: 'short', timeZone: 'UTC' })

export const formatAmount = (value: number) => amount.format(value)
export const formatUnits = (value: number) => `${formatAmount(value)} од.`
export const formatDays = (value: number) => `${formatAmount(value)} дн.`
export const formatPercent = (value: number) => percentage.format(value)
export const formatChange = (value: number) => signedPercent.format(value)
export const dateLabel = (value: string) => fullDate.format(new Date(value))
export const axisDate = (value: string) => shortDate.format(new Date(value))
export const monthLabel = (month: number) => monthName.format(new Date(Date.UTC(2024, month - 1, 1)))
export const axisMonth = (month: number) => monthShort.format(new Date(Date.UTC(2024, month - 1, 1)))
export const dateRange = (from: string, to: string) => from === to ? dateLabel(from) : `${dateLabel(from)} — ${dateLabel(to)}`
const UNIT_LABELS: Record<string, string> = {
  '2009': 'шт',
  '796': 'шт',
  '301': 'кг',
  '166': 'кг',
  '0166': 'л',
  '112': 'л',
  '0006': 'м',
  '6': 'м',
  '0055': 'м²',
  '55': 'м²',
  '0113': 'м³',
  '113': 'м³',
  '2006': 'уп',
  '2007': 'компл',
  '0304': 'г',
  '304': 'г',
  '0163': 'г',
  '163': 'г',
  '0168': 'т',
  '168': 'т',
  '0009': 'км',
  '778': 'уп',
  '839': 'компл',
}

export function formatUnitLabel(unit: string | null | undefined, fallback = '—'): string {
  const trimmed = unit?.trim()
  if (!trimmed) return fallback
  return UNIT_LABELS[trimmed] ?? UNIT_LABELS[trimmed.replace(/^0+(?=\d)/, '')] ?? trimmed
}

export { formatPrice }
