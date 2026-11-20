import type { components } from '@polivalko/shared/api/schema'
import type { WorkFormData, WorkFormLine } from '../api/workFormsApi'
import { emptyWorkFormData, emptyWorkFormLine } from './workFormFields'
import { WORK_FORM_TYPES, type WorkFormSection, type WorkFormType } from './workForms'

type ArchiveDetail = Pick<components['schemas']['DnTradeArchiveDetailDto'],
  'id' | 'entityType' | 'sourceId' | 'documentType' | 'sourceDate' | 'currency' | 'total'>
type SourceObject = Record<string, unknown>

export type ArchivePrefillTemplate = { section: WorkFormSection; type: WorkFormType }
export type ArchivePrefillResult = ArchivePrefillTemplate & {
  title: string
  documentDate: string | null
  sourceRecordId: string | null
  data: WorkFormData
}

const invoiceTypes = new Map<string, WorkFormType>([
  ['out', 'sale'], ['cash', 'sale'], ['in', 'purchase'],
  ['back', 'return'], ['back_from_provider', 'return'],
  ['inventarization', 'inventory'], ['move', 'movement'],
])

const referenceKinds = new Map([
  ['store', 'Склади'], ['cashbox', 'Каси'], ['bankAccount', 'Банківські рахунки'],
  ['partnerCategory', 'Категорії контрагентів'], ['productCategory', 'Категорії товарів'],
  ['salesChannel', 'Канали продажу'], ['orderStatus', 'Статуси замовлень'],
])

const openingReports = new Set([
  'Початкові залишки на межі переходу (чернетка)', 'Звірка початкових залишків DNTrade',
])

const currencyCodes = new Map([
  ['980', 'UAH'], ['840', 'USD'], ['978', 'EUR'], ['985', 'PLN'], ['826', 'GBP'], ['756', 'CHF'],
])

function record(value: unknown): SourceObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as SourceObject : undefined
}

function text(value: unknown, maxLength = 200): string | null {
  if (typeof value !== 'string') return null
  const clean = value.trim()
  return clean && clean.length <= maxLength && !/\p{Cc}/u.test(clean) ? clean : null
}

function identifier(value: unknown): string | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : text(value, 100)
}

function decimal(value: unknown, precision: number): string | null {
  const input = typeof value === 'number' && Number.isFinite(value) ? String(value) : text(value, 40)
  const parts = input?.match(/^(-?[0-9]{1,12})(?:\.([0-9]+))?$/)
  if (!parts) return null
  const [, whole, fraction = ''] = parts
  if (/[1-9]/.test(fraction.slice(precision))) return null
  return fraction ? `${whole}.${fraction.slice(0, precision)}` : whole
}

function currency(value: unknown): string | null {
  const code = identifier(value)?.toUpperCase()
  return code ? currencyCodes.get(code) ?? (/^[A-Z]{3}$/.test(code) ? code : null) : null
}

function sourceDay(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:[T ](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,7})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/.test(value)) return null
  const day = value.slice(0, 10)
  const parsed = new Date(`${day}T00:00:00Z`)
  return day.startsWith('0000') || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day ? null : day
}

function workingType({ entityType, documentType }: ArchiveDetail): WorkFormType | null {
  switch (entityType) {
    case 'invoice': return invoiceTypes.get(documentType ?? '') ?? null
    case 'receipt': return 'sale'
    case 'customerReturn': return 'return'
    case 'cashOrder': return 'cash'
    case 'bankPayment': return 'bank'
    case 'partner': return 'counterparty'
    case 'inventorySnapshot': return 'inventory'
    case 'debtAdjustment': return 'reconciliation'
    case 'financialReport': {
      if (openingReports.has(documentType ?? '')) return 'opening-balance'
      return documentType === 'Взаєморозрахунки з контрагентами' ? 'reconciliation' : null
    }
    default: return referenceKinds.has(entityType) ? 'reference' : null
  }
}

export function archivePrefillTemplate(detail: ArchiveDetail): ArchivePrefillTemplate | null {
  const type = workingType(detail)
  return type ? { section: WORK_FORM_TYPES[type].section, type } : null
}

function matchingRaw(detail: ArchiveDetail, original: unknown): SourceObject | undefined {
  const envelope = record(original)
  if (envelope?.schemaVersion !== 1 || envelope.source !== 'dntrade' ||
      envelope.entityType !== detail.entityType || envelope.sourceId !== detail.sourceId ||
      (envelope.documentType != null && envelope.documentType !== detail.documentType)) return undefined
  return record(envelope.raw)
}

function warehouse(raw: SourceObject): string | null {
  const direct = text(record(raw.store)?.title)
  if (direct || !Array.isArray(raw.products) || raw.products.length === 0) return direct
  const stores = raw.products.map((item: unknown) => record(record(item)?.store))
  const title = text(stores[0]?.title)
  const id = text(stores[0]?.external_id)
  return title && id && stores.every((store) => text(store?.title) === title && text(store?.external_id) === id) ? title : null
}

function sourceLines(raw: SourceObject | undefined, type: WorkFormType): WorkFormLine[] {
  if (!Array.isArray(raw?.products) || raw.products.length > 100) return []
  return raw.products.flatMap((value: unknown) => {
    const item = record(value)
    const product = record(item?.product)
    const sku = identifier(product?.sku) ?? identifier(product?.code)
    const description = text(product?.title, 500)
    if (!item || (!sku && !description)) return []
    const unit = text(record(product?.unit)?.title, 32) ?? text(product?.unit, 32)
    return [{
      ...emptyWorkFormLine(), sku, description,
      unit: unit && !/^\d+$/.test(unit) ? unit : null,
      quantity: decimal(type === 'inventory' ? item.fact_quantity : item.quantity, 3),
      unitPrice: type === 'inventory' || type === 'movement' ? null : decimal(item.price, 2),
    }]
  })
}

function sourceData(detail: ArchiveDetail, raw: SourceObject | undefined, type: WorkFormType): WorkFormData {
  const data = emptyWorkFormData()
  const organization = text(record(raw?.organization)?.title) ?? text(record(raw?.organization)?.name)
  const counterparty = text(record(raw?.partner)?.title)
  const number = identifier(raw?.number)
  const metadataCurrency = currency(detail.currency)
  const originalCurrency = currency(raw?.currency_iso)
  const currencyCode = metadataCurrency && originalCurrency && metadataCurrency !== originalCurrency
    ? null : metadataCurrency ?? originalCurrency

  switch (type) {
    case 'sale':
    case 'purchase':
    case 'return':
      return { ...data, number, organization, counterparty, currency: currencyCode,
        warehouse: raw ? warehouse(raw) : null, lines: sourceLines(raw, type) }
    case 'cash':
    case 'bank': {
      const documentType = detail.documentType ?? text(raw?.type)
      const direction = documentType === 'in' || documentType === 'out' ? documentType : null
      const account = text(record(type === 'cash' ? raw?.cashbox : raw?.account)?.title)
      return { ...data, number, organization, counterparty, account, direction, currency: currencyCode,
        amount: decimal(raw?.total_sum ?? detail.total, 2) }
    }
    case 'inventory':
    case 'movement':
      if (detail.entityType === 'inventorySnapshot') return data
      return { ...data, number, organization, warehouse: raw ? warehouse(raw) : null,
        destinationWarehouse: type === 'movement' ? text(record(raw?.store_recipient)?.title) : null,
        lines: sourceLines(raw, type) }
    case 'counterparty':
      return { ...data, organization, name: text(raw?.title), code: identifier(raw?.code),
        phone: text(raw?.phone_number, 64), email: text(raw?.email, 254) }
    case 'reference':
      return { ...data, organization, name: text(raw?.title) ?? text(raw?.name) ?? text(record(raw?.account)?.label),
        code: identifier(raw?.code), referenceKind: referenceKinds.get(detail.entityType) ?? null }
    default:
      // Aggregated reports do not identify a single account, party, or actionable balance.
      return data
  }
}

export function archivePrefill(detail: ArchiveDetail, original?: unknown): ArchivePrefillResult | null {
  const template = archivePrefillTemplate(detail)
  if (!template) return null
  const raw = matchingRaw(detail, original)
  const data = sourceData(detail, raw, template.type)
  const document = ['invoice', 'receipt', 'customerReturn', 'cashOrder', 'bankPayment'].includes(detail.entityType)
  const label = WORK_FORM_TYPES[template.type].label
  return {
    ...template,
    title: data.number ? `${label} №${data.number}` : label,
    documentDate: document ? sourceDay(detail.sourceDate) ?? sourceDay(raw?.date) : null,
    sourceRecordId: detail.id,
    data,
  }
}
