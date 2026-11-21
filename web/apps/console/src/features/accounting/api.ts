import { apiFetch } from '@/shared/api/client'
import type { components } from '@polivalko/shared/api/schema'
import { withCsrf } from '@/shared/api/csrf'
import { useApiQuery, type ApiResult } from '@/shared/api/useApiQuery'

export type Page<T> = { total: number; items: T[] }
type S = components['schemas']
export type Partner = S['PartnerRow']
export type Doc = S['DocumentRow']
export type Card = S['DocumentCard']
export type Balance = S['BalanceRow']
export type Report = S['BalanceReport']
export type Ref = S['RegisterReference']
export type PartnerCard = S['PartnerCard']

export async function read<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await apiFetch('/api/v1/console/accounting/' + path, init)
  return response.ok
    ? { response, data: (await response.json()) as T }
    : { response, error: await response.json().catch(() => undefined) }
}
export function useRegister<T>(path: string, enabled = true) {
  return useApiQuery<T>('accounting:' + path, () => read<T>(path), { enabled })
}
export function save(path: string, body: unknown, method: 'POST' | 'PUT' = 'POST') {
  return withCsrf((headers) =>
    read<string>(path, {
      method,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}
export function currencyLabel(currency: string | null | undefined) {
  return currency ? ({ '980': 'грн', UAH: 'грн', '840': 'USD', '978': 'EUR' }[currency] ?? currency) : ''
}

export function money(value: string | null, currency?: string | null) {
  if (value === null) return '—'
  const [whole, fraction = ''] = value.split('.')
  const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + fraction.padEnd(2, '0')
  return (
    formatted + (currency ? ' ' + currencyLabel(currency) : '')
  )
}
export function kindName(d: { entityType: string | null; kind: string | null }) {
  if (d.entityType === 'invoice')
    return (
      {
        in: 'Прибуткова накладна',
        out: 'Видаткова накладна',
        start: 'Початкові залишки',
        move: 'Переміщення',
        correct: 'Коригування',
        order: 'Замовлення',
        inventarization: 'Інвентаризація',
        writeoff: 'Списання',
      }[d.kind ?? ''] ?? d.kind
    )
  return (
    { receipt: 'Чек', customerReturn: 'Повернення', cashOrder: 'Касовий ордер', bankPayment: 'Банківський платіж' }[
      d.entityType ?? ''
    ] ??
    d.entityType ??
    'Документ'
  )
}
export const statusNames: Record<string, string> = {
  active: 'Активний',
  deactivated: 'Деактивований',
  deleted: 'Видалений',
  draft: 'Чернетка',
  posted: 'Проведено',
}

export const paymentNames: Record<string, string> = {
  unpaid: 'Без оплати',
  partial: 'Частково оплачено',
  settled: 'Закрито',
}
