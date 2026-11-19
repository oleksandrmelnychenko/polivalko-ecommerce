export const ARCHIVE_PATH = '/system/dntrade-archive'

const entityLabels: Record<string, string> = {
  invoice: 'Накладна',
  cashOrder: 'Касовий ордер',
  bankPayment: 'Банківський платіж',
  order: 'Замовлення',
  partner: 'Контрагент',
  store: 'Склад',
  cashbox: 'Каса',
  partnerCategory: 'Категорія контрагентів',
  salesChannel: 'Канал продажу',
  orderStatus: 'Статус замовлення',
  productCategory: 'Категорія товарів',
  receipt: 'Чек',
  customerReturn: 'Повернення від покупця',
}

export const ARCHIVE_ENTITY_OPTIONS = Object.entries(entityLabels).map(([value, label]) => ({ value, label }))

export function archiveEntityLabel(entityType: string): string {
  return Object.hasOwn(entityLabels, entityType) ? entityLabels[entityType] : entityType
}

export function archiveSourceDate(value: string | null, showTime = false): string {
  if (!value) return '—'
  const [day, time] = value.split(/[T ]/, 2)
  const date = day.split('-').reverse().join('.')
  return showTime && time ? `${date} ${time.replace(/Z$/, ' UTC')}` : date
}

const amountFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 20 })

export function archiveAmount(value: number | string | null, currency: string | null): string {
  return value == null ? '—' : `${amountFormat.format(Number(value))}${currency ? ` ${currency}` : ''}`
}
