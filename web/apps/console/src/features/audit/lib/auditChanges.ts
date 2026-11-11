import { plural } from '@polivalko/shared/lib/format'
import { orderStatusLabel } from '@polivalko/shared/lib/labels'
import type { AuditEntry } from '@/shared/audit/auditApi'

export type AuditValue = { text: string; empty?: boolean; mono?: boolean; list?: string[] }

export type AuditDiffRow = { key: string; label: string; before: AuditValue; after: AuditValue }

export type AuditFieldRow = { key: string; label: string; value: AuditValue }

export type AuditChanges = { diff: AuditDiffRow[]; unchanged: number; fields: AuditFieldRow[] }

const FIELD_LABELS: Record<string, string> = {
  name: 'Назва',
  title: 'Заголовок',
  slug: 'Адреса',
  parentId: 'Батьківська категорія',
  navkoloRef: 'Група Navkolo',
  isVisible: 'На сайті',
  visible: 'На сайті',
  sortOrder: 'Порядок',
  filterAttributes: 'Фільтри',
  products: 'Товари',
  rows: 'Рядків',
  status: 'Стан',
  fileName: 'Файл',
  errorCount: 'Помилок',
  kind: 'Тип',
  tone: 'Колір',
  newDays: 'Днів «новинки»',
  isActive: 'Увімкнено',
  url: 'Файл',
  brand: 'Бренд',
  seoTitle: 'SEO-заголовок',
  seoDescription: 'SEO-опис',
  categoryId: 'Категорія',
  attributes: 'Характеристики',
  skus: 'Артикули',
  addLabelIds: 'Додано мітки',
  removeLabelIds: 'Знято мітки',
  to: 'Куди',
  toPath: 'Куди',
  email: 'Email',
  viber: 'Viber',
  mapUrl: 'Карта',
  address: 'Адреса',
  youTube: 'YouTube',
  facebook: 'Facebook',
  schedule: 'Графік',
  telegram: 'Telegram',
  instagram: 'Instagram',
  storePhone: 'Телефон магазину',
  servicesPhone: 'Телефон послуг',
  specialDays: 'Особливі дні',
  length: 'Розмір',
  imageUrl: 'Фото',
  mobileImageUrl: 'Фото для телефона',
  pickup: 'Самовивіз',
  courier: "Кур'єр",
  novaPoshta: 'Нова пошта',
  contentType: 'Тип файлу',
  id: 'Ідентифікатор',
  lines: 'Позицій',
  amount: 'Сума',
  method: 'Спосіб',
  reason: 'Причина',
  description: 'Опис',
  permissions: 'Права',
  emails: 'Email-адреси',
  events: 'Події',
  telegramChatIds: 'Чати Telegram',
  seller: 'Продавець',
  link: 'Посилання',
  text: 'Текст',
  startsAt: 'Показ з',
  endsAt: 'Показ до',
  buttonLabel: 'Кнопка',
  ids: 'Новий порядок',
  perks: 'Переваги',
  steps: 'Кроки',
  visit: 'Блок «Магазин»',
  blocks: 'Блоки головної',
  announcement: 'Оголошення',
  product: 'Шаблон товару',
  category: 'Шаблон категорії',
  role: 'Роль',
  confirmedByCode: 'Підтверджено кодом',
}

const ORDER_STATUSES = ['new', 'awaitingConfirmation', 'confirmed', 'awaitingPayment', 'paid', 'shipped', 'readyForPickup', 'completed', 'cancelled'] as const

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LIST_LIMIT = 12
const numberFormat = new Intl.NumberFormat('uk-UA')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fieldLabel(key: string, entry: AuditEntry): string {
  if (key === 'name' && entry.entityType === 'StaffUser') return "Ім'я"
  if (key === 'from' || key === 'to') return entry.action === 'order.status_changed' ? 'Статус' : key === 'to' ? 'Куди' : 'Звідки'
  if (key === 'value') return entry.action === 'order.note_changed' ? 'Нотатка' : 'Значення'
  const [head, ...rest] = key.split('.')
  const label = FIELD_LABELS[head]
  if (!label) return key
  return rest.length ? `${label}: ${rest.join('.')}` : label
}

function display(value: unknown, key: string, entry: AuditEntry): AuditValue {
  if (value === null || value === undefined || value === '') return { text: 'порожньо', empty: true }
  if (typeof value === 'boolean') return { text: value ? 'так' : 'ні' }
  if (entry.action === 'order.status_changed' && (key === 'from' || key === 'to')) {
    const status = typeof value === 'number' ? ORDER_STATUSES[value] : value
    const label = typeof status === 'string' ? orderStatusLabel[status as keyof typeof orderStatusLabel] : undefined
    return { text: label ?? String(value) }
  }
  if (typeof value === 'number') return { text: numberFormat.format(value) }
  if (typeof value === 'string') return { text: value, mono: GUID.test(value) || value.startsWith('/') }
  if (Array.isArray(value)) {
    if (value.length === 0) return { text: 'порожньо', empty: true }
    if (value.every((item) => item === null || typeof item !== 'object')) {
      const items = value.map((item) => String(item))
      const shown = items.slice(0, LIST_LIMIT)
      if (items.length > LIST_LIMIT) shown.push(`ще ${numberFormat.format(items.length - LIST_LIMIT)}`)
      return { text: items.join(', '), list: shown }
    }
    return { text: `${numberFormat.format(value.length)} ${plural(value.length, 'запис', 'записи', 'записів')}` }
  }
  return { text: 'набір полів, див. технічні деталі' }
}

function flatten(record: Record<string, unknown>, prefix = '', depth = 0): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (isRecord(value) && depth < 1) Object.assign(out, flatten(value, path, depth + 1))
    else out[path] = value
  }
  return out
}

function normalize(side: Record<string, unknown>): Record<string, unknown> {
  if ('displayName' in side && !('name' in side)) {
    const { displayName, ...rest } = side
    return { name: displayName, ...rest }
  }
  return side
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export function readChanges(entry: AuditEntry): AuditChanges | null {
  const details: unknown = entry.details
  if (details == null) return null
  if (!isRecord(details)) return { diff: [], unchanged: 0, fields: [{ key: 'value', label: fieldLabel('value', entry), value: display(details, 'value', entry) }] }

  const diff: AuditDiffRow[] = []
  const fields: AuditFieldRow[] = []
  let unchanged = 0
  let rest: Record<string, unknown> = details

  if ('before' in details || 'after' in details) {
    const { before, after, ...others } = details
    rest = others
    if (isRecord(before) || isRecord(after)) {
      const was = flatten(normalize(isRecord(before) ? before : {}))
      const now = flatten(normalize(isRecord(after) ? after : {}))
      const keys = [...new Set([...Object.keys(now), ...Object.keys(was)])]
      for (const key of keys) {
        if (same(was[key], now[key])) unchanged += 1
        else diff.push({ key, label: fieldLabel(key, entry), before: display(was[key], key, entry), after: display(now[key], key, entry) })
      }
    } else if (!same(before, after)) {
      diff.push({ key: 'value', label: fieldLabel('value', entry), before: display(before, 'value', entry), after: display(after, 'value', entry) })
    }
  } else if ('from' in details && 'to' in details) {
    const { from, to, ...others } = details
    rest = others
    diff.push({ key: 'from', label: fieldLabel('from', entry), before: display(from, 'from', entry), after: display(to, 'to', entry) })
  }

  for (const [key, value] of Object.entries(rest)) {
    if (value == null || (Array.isArray(value) && value.length === 0)) continue
    fields.push({ key, label: fieldLabel(key, entry), value: display(value, key, entry) })
  }
  return { diff, unchanged, fields }
}
