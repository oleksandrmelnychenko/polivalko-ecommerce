export const PERMISSION_CATALOG_VERSION = '2026-11-20.4'

export const PermissionKeys = {
  Accounting: { View: 'accounting.registers.view', Edit: 'accounting.registers.edit', Post: 'accounting.invoices.post', Pay: 'accounting.payments.record', Opening: 'accounting.stock.open', BalanceOpening: 'accounting.settlements.open' },
  Dashboard: {
    View: 'dashboard.page.view',
  },
  Analytics: {
    ViewProducts: 'analytics.products.view',
  },
  Orders: {
    View: 'orders.page.view',
    ChangeStatus: 'orders.status.change',
    CreateRefund: 'orders.refund.create',
    Export: 'orders.export',
  },
  Customers: {
    View: 'customers.page.view',
    ManageAccounts: 'customers.accounts.manage',
  },
  Requests: {
    View: 'requests.page.view',
    ChangeStatus: 'requests.status.change',
  },
  Catalog: {
    ViewProducts: 'catalog.products.view',
    EditProducts: 'catalog.products.edit',
    ManageCollections: 'catalog.collections.manage',
    ManageCategories: 'catalog.categories.manage',
    ManageRedirects: 'catalog.redirects.manage',
    RunImport: 'catalog.import.run',
    ManageAttributes: 'catalog.attributes.manage',
    ManageBrands: 'catalog.brands.manage',
    ManageLabels: 'catalog.labels.manage',
  },
  Content: {
    ManageSite: 'content.site.manage',
    ManagePickup: 'delivery.pickup.manage',
  },
  Site: {
    ManageHome: 'site.home.manage',
    ManageSeo: 'site.seo.manage',
  },
  Settings: {
    ManageShop: 'settings.shop.manage',
    ManageNavkolo: 'settings.navkolo.manage',
    ManageNotifications: 'settings.notifications.manage',
  },
  Integration: {
    ViewStatus: 'integration.status.view',
    RunJobs: 'integration.jobs.run',
    ManageOutbox: 'integration.outbox.manage',
  },
  DnTradeArchive: {
    View: 'dntrade.archive.view',
    Import: 'dntrade.archive.import',
    Original: 'dntrade.archive.original',
  },
  Audit: {
    View: 'audit.page.view',
  },
  Staff: {
    ManageUsers: 'staff.users.manage',
    ManageRoles: 'staff.roles.manage',
  },
} as const

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T]

export type PermissionKey = Leaves<typeof PermissionKeys>

export const DNTRADE_FORM_ADDITIONAL_PERMISSIONS = [PermissionKeys.DnTradeArchive.View, PermissionKeys.DnTradeArchive.Original] as const

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'accounting.registers.view': 'Облік: перегляд реєстрів',
  'accounting.registers.edit': 'Облік: створення записів',
  'accounting.invoices.post': 'Проведення накладних',
  'accounting.payments.record': 'Реєстрація оплат',
  'accounting.stock.open': 'Введення початкових залишків',
  'accounting.settlements.open': 'Підтвердження початкових боргів',
  'dashboard.page.view': 'Огляд: перегляд показників',
  'analytics.products.view': 'Аналітика товарів: перегляд',
  'orders.page.view': 'Замовлення: список і картка',
  'orders.status.change': 'Зміна статусу замовлення',
  'orders.refund.create': 'Оформлення повернення коштів',
  'orders.export': 'Експорт замовлень у CSV',
  'customers.page.view': 'Покупці: список і контакти',
  'customers.accounts.manage': 'Кабінети покупців: блокування, скидання пароля',
  'requests.page.view': 'Заявки на послуги: перегляд',
  'requests.status.change': 'Зміна статусу заявки',
  'catalog.products.view': 'Товари: перегляд',
  'catalog.products.edit': 'Товари: редагування, фото, видимість',
  'catalog.collections.manage': 'Добірки головної',
  'catalog.categories.manage': 'Категорії каталогу',
  'catalog.redirects.manage': 'Перенаправлення адрес (SEO)',
  'catalog.import.run': 'Імпорт товарів з файлу',
  'catalog.attributes.manage': 'Характеристики: довідник і фільтри',
  'catalog.brands.manage': 'Бренди',
  'catalog.labels.manage': 'Мітки товарів',
  'content.site.manage': 'Сторінки й послуги',
  'site.home.manage': 'Головна й банери',
  'site.seo.manage': 'SEO: мета-шаблони',
  'settings.shop.manage': 'Магазин: контакти, графік, реквізити',
  'settings.navkolo.manage': 'Навколо: підключення',
  'settings.notifications.manage': 'Сповіщення',
  'delivery.pickup.manage': 'Доставка й самовивіз',
  'integration.status.view': 'Стан синхронізацій',
  'integration.jobs.run': 'Запуск синхронізацій вручну',
  'integration.outbox.manage': 'Черга операцій і повтор',
  'dntrade.archive.view': 'Архів DNTrade: перегляд',
  'dntrade.archive.import': 'Архів DNTrade: імпорт',
  'dntrade.archive.original': 'Архів DNTrade: завантаження оригіналів',
  'audit.page.view': 'Журнал змін',
  'staff.users.manage': 'Працівники: створення, ролі, паролі, блокування',
  'staff.roles.manage': 'Ролі та права',
}

export const PERMISSION_KEYS = Object.freeze(Object.keys(PERMISSION_LABELS) as PermissionKey[])

const known = new Set<string>(PERMISSION_KEYS)

export function isPermissionKey(value: string): value is PermissionKey {
  return known.has(value)
}
