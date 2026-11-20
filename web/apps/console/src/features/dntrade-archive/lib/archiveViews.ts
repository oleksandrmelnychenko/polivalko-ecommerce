import { ARCHIVE_PATH } from './archive'

type ArchiveViewId = 'all' | 'sales' | 'finance' | 'warehouse' | 'directories'

export type ArchiveView = {
  id: ArchiveViewId
  label: string
  entityTypes: readonly string[]
}

const ALL_VIEW: ArchiveView = { id: 'all', label: 'Весь архів', entityTypes: [] }

export const ARCHIVE_VIEWS: readonly ArchiveView[] = [
  ALL_VIEW,
  { id: 'sales', label: 'Продажі', entityTypes: ['receipt', 'invoice', 'customerReturn', 'order', 'sourceReport'] },
  { id: 'finance', label: 'Фінанси', entityTypes: ['financialReport', 'cashOrder', 'bankPayment', 'debtAdjustment', 'bankAccount', 'cashbox'] },
  { id: 'warehouse', label: 'Склади', entityTypes: ['inventorySnapshot', 'store', 'sourceReport'] },
  { id: 'directories', label: 'Довідники', entityTypes: ['productCategory', 'partner', 'partnerCategory', 'salesChannel', 'orderStatus', 'sourceReport'] },
]

type ArchiveReport = {
  value: string
  label: string
  entityType: string
  shortcut?: boolean
}

const REPORT_GROUPS: { view: ArchiveViewId; group: string; items: ArchiveReport[] }[] = [
  {
    view: 'sales',
    group: 'Продажі',
    items: [
      { value: 'Чеки DNTrade на межі переходу', label: 'Чеки на межі переходу', entityType: 'sourceReport', shortcut: true },
    ],
  },
  {
    view: 'finance',
    group: 'Перехід та оплати',
    items: [
      { value: 'Початкові залишки на межі переходу (чернетка)', label: 'Початкові залишки (чернетка)', entityType: 'financialReport', shortcut: true },
      { value: 'Звірка початкових залишків DNTrade', label: 'Звірка початкових залишків (чернетка)', entityType: 'financialReport', shortcut: true },
      { value: 'Зв’язки оплат DNTrade', label: 'Зв’язки оплат', entityType: 'financialReport', shortcut: true },
    ],
  },
  {
    view: 'finance',
    group: 'Каса й банк',
    items: [
      { value: 'Рух коштів', label: 'Рух коштів', entityType: 'financialReport' },
      { value: 'Звіт по рахунках', label: 'Звіти по банку', entityType: 'financialReport', shortcut: true },
      { value: 'Звіт по касі', label: 'Звіти по касі', entityType: 'financialReport', shortcut: true },
      { value: 'Звіт по змінам', label: 'Звіт про касові зміни', entityType: 'financialReport' },
      { value: 'Реєстр Z-звітів', label: 'Реєстр Z-звітів', entityType: 'financialReport' },
      { value: 'Банківський рахунок DNTrade', label: 'Банківські рахунки DNTrade', entityType: 'bankAccount' },
    ],
  },
  {
    view: 'finance',
    group: 'Заборгованість',
    items: [
      { value: 'Взаєморозрахунки з контрагентами', label: 'Залишки за контрагентами', entityType: 'financialReport', shortcut: true },
      { value: 'Журнал коригувань заборгованості', label: 'Журнал коригувань заборгованості', entityType: 'financialReport' },
    ],
  },
  {
    view: 'finance',
    group: 'Облікові звіти й налаштування',
    items: [
      { value: 'Облікові параметри організацій', label: 'Облікові параметри організацій', entityType: 'financialReport' },
      { value: 'Прибутки та витрати (P&L)', label: 'Прибутки та витрати (P&L)', entityType: 'financialReport' },
      { value: 'Звіт по витратам', label: 'Звіт про витрати', entityType: 'financialReport' },
      { value: 'Валовий прибуток', label: 'Валовий прибуток', entityType: 'financialReport' },
    ],
  },
  {
    view: 'warehouse',
    group: 'Складські звіти',
    items: [
      { value: 'Залишки на складі', label: 'Звіти про залишки', entityType: 'inventorySnapshot', shortcut: true },
      { value: 'Залишки на складі Буча на межі переходу', label: 'Залишки Бучі на межі переходу', entityType: 'inventorySnapshot', shortcut: true },
      { value: 'Деактивовані товари із залишком у Бучі', label: 'Деактивовані товари із залишком у Бучі', entityType: 'inventorySnapshot', shortcut: true },
      { value: 'Склади', label: 'Довідник складів', entityType: 'sourceReport' },
    ],
  },
  {
    view: 'directories',
    group: 'Довідники',
    items: [
      { value: 'Зіставлення всіх категорій DNTrade', label: 'Зіставлення категорій', entityType: 'sourceReport', shortcut: true },
      { value: 'Довідник товарів DNTrade', label: 'Довідник товарів DNTrade', entityType: 'sourceReport' },
      { value: 'Одиниці виміру', label: 'Одиниці виміру', entityType: 'sourceReport' },
      { value: 'Типи цін', label: 'Типи цін', entityType: 'sourceReport' },
      { value: 'Підрозділи організацій', label: 'Підрозділи організацій', entityType: 'sourceReport' },
    ],
  },
]

export function readArchiveView(params: URLSearchParams) {
  return ARCHIVE_VIEWS.find(({ id }) => id === params.get('view')) ?? ALL_VIEW
}

export function archiveViewEntityType(view: ArchiveView, entityType: string) {
  if (view.id === 'all' || view.entityTypes.includes(entityType)) return entityType
  return view.entityTypes[0]
}

export function archiveReportGroups(view: ArchiveView) {
  return view.id === 'all' ? REPORT_GROUPS : REPORT_GROUPS.filter((group) => group.view === view.id)
}

const allReports = REPORT_GROUPS.flatMap(({ items }) => items)

export function archiveViewLocation(view: ArchiveView, currentView: ArchiveView, params: URLSearchParams) {
  if (view.id === currentView.id) return { pathname: ARCHIVE_PATH, search: params.toString() }

  const next = new URLSearchParams(params)
  const q = next.get('q')
  const selectedType = next.get('entityType') ?? ''
  const entityType = archiveViewEntityType(currentView, selectedType)
  const isReport = allReports.some((report) => report.value === q && report.entityType === entityType)
  if (isReport) next.delete('q')
  if (isReport || archiveViewEntityType(view, selectedType) !== selectedType) next.delete('entityType')
  next.delete('page')
  if (view.id === 'all') next.delete('view')
  else next.set('view', view.id)
  return { pathname: ARCHIVE_PATH, search: next.toString() }
}

export function archiveShortcuts(view: ArchiveView, params: URLSearchParams) {
  return archiveReportGroups(view).flatMap((group) => group.items.filter(({ shortcut }) => shortcut).map((report) => {
    const search = new URLSearchParams({ view: group.view, entityType: report.entityType, q: report.value })
    const pageSize = params.get('pageSize')
    if (pageSize) search.set('pageSize', pageSize)
    const active = view.id === group.view &&
      archiveViewEntityType(view, params.get('entityType') ?? '') === report.entityType &&
      params.get('q') === report.value &&
      !['sourceAccount', 'storeId', 'from', 'to'].some((key) => params.has(key))
    return { label: report.label, location: { pathname: ARCHIVE_PATH, search: search.toString() }, active }
  }))
}
