export const WORK_FORMS_PATH = '/system/dntrade-work-forms'

export const WORK_FORM_SECTIONS = [
  { value: 'sales', label: 'Продажі' },
  { value: 'finance', label: 'Фінанси' },
  { value: 'warehouse', label: 'Склади' },
  { value: 'directory', label: 'Довідники' },
] as const

export type WorkFormSection = (typeof WORK_FORM_SECTIONS)[number]['value']

export const WORK_FORM_TYPES = {
  sale: { section: 'sales', label: 'Продаж' },
  purchase: { section: 'sales', label: 'Закупівля' },
  return: { section: 'sales', label: 'Повернення' },
  cash: { section: 'finance', label: 'Касова операція' },
  bank: { section: 'finance', label: 'Банківська операція' },
  'opening-balance': { section: 'finance', label: 'Початкові залишки' },
  reconciliation: { section: 'finance', label: 'Звірка' },
  inventory: { section: 'warehouse', label: 'Інвентаризація' },
  movement: { section: 'warehouse', label: 'Переміщення' },
  counterparty: { section: 'directory', label: 'Контрагент' },
  reference: { section: 'directory', label: 'Позиція довідника' },
} as const satisfies Record<string, { section: WorkFormSection; label: string }>

export type WorkFormType = keyof typeof WORK_FORM_TYPES

export const WORK_FORM_STATUSES = [
  { value: 'draft', label: 'Чернетка' },
  { value: 'ready', label: 'Готова до перевірки' },
  { value: 'archived', label: 'В архіві робочих форм' },
] as const

export type WorkFormStatus = (typeof WORK_FORM_STATUSES)[number]['value']

export function readWorkFormSection(raw: string | null): WorkFormSection | undefined {
  return WORK_FORM_SECTIONS.find(({ value }) => value === raw)?.value
}

export function readWorkFormStatus(raw: string | null): WorkFormStatus | undefined {
  return WORK_FORM_STATUSES.find(({ value }) => value === raw)?.value
}

export function readWorkFormType(raw: string | null): WorkFormType | undefined {
  return raw && Object.hasOwn(WORK_FORM_TYPES, raw) ? raw as WorkFormType : undefined
}

export function workFormTypeOptions(section: WorkFormSection) {
  return (Object.keys(WORK_FORM_TYPES) as WorkFormType[])
    .filter((type) => WORK_FORM_TYPES[type].section === section)
    .map((value) => ({ value, label: WORK_FORM_TYPES[value].label }))
}

export function workFormSectionLabel(section: string) {
  return WORK_FORM_SECTIONS.find(({ value }) => value === section)?.label ?? section
}

export function workFormStatusLabel(status: string) {
  return WORK_FORM_STATUSES.find(({ value }) => value === status)?.label ?? status
}

export function workFormTypeLabel(type: string) {
  const known = readWorkFormType(type)
  return known ? WORK_FORM_TYPES[known].label : type
}

export function workFormCreateHref({
  sourceRecordId,
  section,
  type,
}: { sourceRecordId?: string; section?: WorkFormSection; type?: WorkFormType } = {}) {
  const params = new URLSearchParams()
  if (sourceRecordId) params.set('archiveId', sourceRecordId)
  if (section) params.set('section', section)
  if (type) params.set('type', type)
  return { pathname: `${WORK_FORMS_PATH}/new`, search: params.toString() }
}

export function workFormPreset(params: URLSearchParams) {
  const type = readWorkFormType(params.get('type'))
  const section = type ? WORK_FORM_TYPES[type].section : readWorkFormSection(params.get('section')) ?? 'sales'
  return { section, type: type ?? workFormTypeOptions(section)[0].value, sourceRecordId: params.get('archiveId') || null }
}
