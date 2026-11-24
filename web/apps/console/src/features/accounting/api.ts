import type { components } from '@polivalko/shared/api/schema'
export { read, save, useRegister, ACCOUNTING_DOCUMENT_CHANGED, type Page, type Partner } from '@/shared/api/accounting'
type S = components['schemas']
export type Doc = S['DocumentRow']
export type Card = S['DocumentCard']
export type Balance = S['BalanceRow']
export type Report = S['BalanceReport']
export type Ref = S['RegisterReference']
export type PartnerCard = S['PartnerCard']
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
export const stockOperationNames: Record<string, string> = {
  income: 'Оприбуткування',
  writeOff: 'Списання',
  recount: 'Перерахунок',
}

export const writeOffReasons: Record<string, string> = {
  defect: 'Брак',
  loss: 'Втрата',
  regrade: 'Пересорт',
  own: 'Власні потреби',
  other: 'Інше',
}

export function kindName(d: { entityType: string | null; kind: string | null }) {
  if (d.entityType === 'stockOperation') return stockOperationNames[d.kind ?? ''] ?? 'Складська операція'
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
  cancelled: 'Скасовано',
}

export const paymentNames: Record<string, string> = {
  unpaid: 'Без оплати',
  partial: 'Частково оплачено',
  settled: 'Закрито',
}
