export const ARCHIVE_PATH = '/system/dntrade-archive'

const entityLabels: Record<string, string> = {
  invoice: 'Накладна',
  cashOrder: 'Касовий ордер',
  bankPayment: 'Банківський платіж',
  financialReport: 'Фінансовий звіт',
  bankAccount: 'Банківський рахунок',
  debtAdjustment: 'Коригування заборгованості',
  inventorySnapshot: 'Залишки на складі',
  sourceReport: 'Звіт або довідник DNTrade',
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

const previewEntityTypes = ['financialReport', 'bankAccount', 'inventorySnapshot', 'sourceReport'] as const
export type ArchivePreviewEntityType = (typeof previewEntityTypes)[number]

export function hasArchivePreview(entityType: string): entityType is ArchivePreviewEntityType {
  return previewEntityTypes.some((type) => type === entityType)
}

export function archiveEntityLabel(entityType: string): string {
  return Object.hasOwn(entityLabels, entityType) ? entityLabels[entityType] : entityType
}

// DNTrade marks the shop's own clock time as UTC. The mark is left out: with it the time reads as
// two or three hours earlier than it was. Any other offset is shown as written.
export function archiveSourceDate(value: string | null, showTime = false): string {
  if (!value) return '—'
  const [day, time] = value.split(/[T ]/, 2)
  const date = day.split('-').reverse().join('.')
  return showTime && time ? `${date} ${time.replace(/(\.\d+)?(Z|[+-]00:00)$/, '')}` : date
}

const amountFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 20 })

export function archiveAmount(value: number | string | null, currency: string | null): string {
  return value == null ? '—' : `${amountFormat.format(Number(value))}${currency ? ` ${currency}` : ''}`
}
