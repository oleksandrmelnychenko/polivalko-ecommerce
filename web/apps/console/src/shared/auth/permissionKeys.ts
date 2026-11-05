export const PERMISSION_CATALOG_VERSION = '2026-11-06.1'

export const PermissionKeys = {
  Dashboard: {
    View: 'dashboard.page.view',
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
    ManageNotifications: 'settings.notifications.manage',
  },
  Integration: {
    ViewStatus: 'integration.status.view',
    RunJobs: 'integration.jobs.run',
    ManageOutbox: 'integration.outbox.manage',
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

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'dashboard.page.view': 'Огляд: перегляд показників',
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
  'settings.notifications.manage': 'Сповіщення',
  'delivery.pickup.manage': 'Доставка й самовивіз',
  'integration.status.view': 'Стан синхронізацій',
  'integration.jobs.run': 'Запуск синхронізацій вручну',
  'integration.outbox.manage': 'Черга операцій і повтор',
  'audit.page.view': 'Журнал змін',
  'staff.users.manage': 'Працівники: створення, ролі, паролі, блокування',
  'staff.roles.manage': 'Ролі та права',
}

export const PERMISSION_KEYS = Object.freeze(Object.keys(PERMISSION_LABELS) as PermissionKey[])

const known = new Set<string>(PERMISSION_KEYS)

export function isPermissionKey(value: string): value is PermissionKey {
  return known.has(value)
}
