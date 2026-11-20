import type { WorkFormData, WorkFormLine } from '../api/workFormsApi'
import type { WorkFormType } from './workForms'

export type WorkDataField = Exclude<keyof WorkFormData, 'lines'>
export type WorkLineField = keyof WorkFormLine

type Field = { label: string; maxLength: number; format?: 'decimal' | 'tel' | 'email' | 'currency' }

export const WORK_DATA_FIELDS: Record<WorkDataField, Field> = {
  number: { label: 'Номер документа', maxLength: 100 },
  organization: { label: 'Організація', maxLength: 200 },
  counterparty: { label: 'Контрагент', maxLength: 200 },
  warehouse: { label: 'Склад', maxLength: 200 },
  destinationWarehouse: { label: 'Склад призначення', maxLength: 200 },
  account: { label: 'Рахунок або каса', maxLength: 200 },
  direction: { label: 'Рух коштів', maxLength: 3 },
  currency: { label: 'Валюта', maxLength: 3, format: 'currency' },
  amount: { label: 'Сума', maxLength: 32, format: 'decimal' },
  name: { label: 'Назва', maxLength: 200 },
  code: { label: 'Код', maxLength: 100 },
  referenceKind: { label: 'Довідник', maxLength: 200 },
  phone: { label: 'Телефон', maxLength: 64, format: 'tel' },
  email: { label: 'Електронна пошта', maxLength: 254, format: 'email' },
  note: { label: 'Примітки', maxLength: 5000 },
}

export const WORK_LINE_FIELDS: Record<WorkLineField, Field> = {
  sku: { label: 'Код товару', maxLength: 100 },
  description: { label: 'Найменування', maxLength: 500 },
  unit: { label: 'Од. виміру', maxLength: 32 },
  quantity: { label: 'Кількість', maxLength: 32, format: 'decimal' },
  expectedQuantity: { label: 'Облікова кількість', maxLength: 32, format: 'decimal' },
  unitPrice: { label: 'Ціна за одиницю', maxLength: 32, format: 'decimal' },
}

export const WORK_FORM_DIRECTION = [
  { value: 'in', label: 'Надходження' },
  { value: 'out', label: 'Вибуття' },
] as const

const TRADE_FIELDS = ['number', 'organization', 'counterparty', 'warehouse', 'currency'] as const
const PAYMENT_FIELDS = ['number', 'organization', 'counterparty', 'account', 'direction', 'currency', 'amount'] as const
const TRADE_LINES = ['sku', 'description', 'unit', 'quantity', 'unitPrice'] as const

const WORK_FORM_FIELDS = {
  sale: { details: 'Реквізити продажу', fields: TRADE_FIELDS, lines: TRADE_LINES },
  purchase: { details: 'Реквізити закупівлі', fields: TRADE_FIELDS, lines: TRADE_LINES },
  return: { details: 'Реквізити повернення', fields: TRADE_FIELDS, lines: TRADE_LINES },
  cash: { details: 'Реквізити касової операції', fields: PAYMENT_FIELDS, lines: [] },
  bank: { details: 'Реквізити банківської операції', fields: PAYMENT_FIELDS, lines: [] },
  'opening-balance': { details: 'Початковий залишок', fields: ['organization', 'account', 'currency', 'amount'], lines: [] },
  reconciliation: { details: 'Дані звірки', fields: ['number', 'organization', 'counterparty', 'account', 'currency', 'amount'], lines: [] },
  inventory: { details: 'Реквізити інвентаризації', fields: ['number', 'organization', 'warehouse'], lines: ['sku', 'description', 'unit', 'expectedQuantity', 'quantity'] },
  movement: { details: 'Маршрут переміщення', fields: ['number', 'organization', 'warehouse', 'destinationWarehouse'], lines: ['sku', 'description', 'unit', 'quantity'] },
  counterparty: { details: 'Відомості про контрагента', fields: ['name', 'code', 'phone', 'email', 'organization'], lines: [] },
  reference: { details: 'Відомості довідника', fields: ['referenceKind', 'name', 'code', 'organization', 'warehouse'], lines: [] },
} as const satisfies Record<WorkFormType, { details: string; fields: readonly WorkDataField[]; lines: readonly WorkLineField[] }>

export function workFormFields(type: WorkFormType): { details: string; fields: readonly WorkDataField[]; lines: readonly WorkLineField[] } {
  return WORK_FORM_FIELDS[type]
}

const READY_FIELDS: Record<WorkFormType, readonly WorkDataField[]> = {
  sale: ['currency'], purchase: ['currency'], return: ['currency'],
  cash: ['organization', 'account', 'direction', 'currency', 'amount'],
  bank: ['organization', 'account', 'direction', 'currency', 'amount'],
  'opening-balance': ['organization', 'account', 'currency', 'amount'],
  reconciliation: ['counterparty', 'amount', 'currency'],
  inventory: ['warehouse'], movement: ['warehouse', 'destinationWarehouse'],
  counterparty: ['name'], reference: ['name'],
}

export function requiresWorkDataField(type: WorkFormType, field: WorkDataField) {
  return READY_FIELDS[type].includes(field)
}

export function workDataFieldLabel(field: WorkDataField, type: WorkFormType) {
  if (field === 'warehouse' && type === 'movement') return 'Склад відправлення'
  if (field === 'account' && type === 'cash') return 'Каса'
  if (field === 'account' && type === 'bank') return 'Банківський рахунок'
  return WORK_DATA_FIELDS[field].label
}

export function workLineFieldLabel(field: WorkLineField, type: WorkFormType) {
  return field === 'quantity' && type === 'inventory' ? 'Фактична кількість' : WORK_LINE_FIELDS[field].label
}

export function emptyWorkFormData(): WorkFormData {
  return {
    number: null, organization: null, counterparty: null, warehouse: null, destinationWarehouse: null,
    account: null, direction: null, currency: null, amount: null, name: null, code: null, referenceKind: null,
    phone: null, email: null, note: null, lines: [],
  }
}

export function emptyWorkFormLine(): WorkFormLine {
  return { sku: null, description: null, unit: null, quantity: null, expectedQuantity: null, unitPrice: null }
}

export function workFieldValue(value: string | null, field: Field): string | null {
  const text = value?.trim()
  if (!text) return null
  if (field.format === 'decimal') return text.replace(',', '.')
  if (field.format === 'currency') return text.toUpperCase()
  return value
}
