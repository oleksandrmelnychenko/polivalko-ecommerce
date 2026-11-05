import {
  IconAdjustmentsHorizontal,
  IconBell,
  IconBuildingStore,
  IconCategory,
  IconCertificate,
  IconClipboardList,
  IconCreditCard,
  IconFileText,
  IconHistory,
  IconHome,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconPhoto,
  IconPlugConnected,
  IconReceiptRefund,
  IconSeo,
  IconShieldLock,
  IconShoppingBag,
  IconTag,
  IconTags,
  IconTool,
  IconTruckDelivery,
  IconUserCog,
  IconUsers,
  type Icon,
} from '@tabler/icons-react'
import type { components } from '@polivalko/shared/api/schema'
import { PermissionKeys, type PermissionKey } from '@/shared/auth/permissionKeys'

export type ConsoleSummary = components['schemas']['ConsoleSummaryDto']

export type NavBadgeTone = 'hot' | 'bad'

export type NavItem = {
  id: string
  label: string
  path: string
  permissionKey: PermissionKey
  alsoAllowedBy?: readonly PermissionKey[]
  icon: Icon
  badge?: (summary: ConsoleSummary) => number
  badgeTone?: NavBadgeTone
}

export type NavSection = {
  id: string
  label: string
  prefix?: string
  items: NavItem[]
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: 'dashboard',
    label: 'Дашборд',
    items: [{ id: 'dashboard', label: 'Дашборд', path: '/', permissionKey: PermissionKeys.Dashboard.View, icon: IconLayoutDashboard }],
  },
  {
    id: 'sales',
    label: 'Продажі',
    prefix: '/sales',
    items: [
      {
        id: 'orders',
        label: 'Замовлення',
        path: '/sales/orders',
        permissionKey: PermissionKeys.Orders.View,
        icon: IconShoppingBag,
        badge: (summary) => summary.newOrders + summary.awaitingConfirmation,
        badgeTone: 'hot',
      },
      {
        id: 'requests',
        label: 'Заявки',
        path: '/sales/requests',
        permissionKey: PermissionKeys.Requests.View,
        icon: IconClipboardList,
        badge: (summary) => summary.newServiceRequests,
        badgeTone: 'hot',
      },
      { id: 'returns', label: 'Повернення', path: '/sales/returns', permissionKey: PermissionKeys.Orders.View, icon: IconReceiptRefund },
      { id: 'customers', label: 'Покупці', path: '/sales/customers', permissionKey: PermissionKeys.Customers.View, icon: IconUsers },
    ],
  },
  {
    id: 'catalog',
    label: 'Каталог',
    prefix: '/catalog',
    items: [
      { id: 'products', label: 'Товари', path: '/catalog/products', permissionKey: PermissionKeys.Catalog.ViewProducts, icon: IconTag },
      { id: 'categories', label: 'Категорії', path: '/catalog/categories', permissionKey: PermissionKeys.Catalog.ManageCategories, icon: IconCategory },
      { id: 'attributes', label: 'Характеристики', path: '/catalog/attributes', permissionKey: PermissionKeys.Catalog.ManageAttributes, icon: IconAdjustmentsHorizontal },
      { id: 'brands', label: 'Бренди', path: '/catalog/brands', permissionKey: PermissionKeys.Catalog.ManageBrands, icon: IconCertificate },
      { id: 'labels', label: 'Мітки', path: '/catalog/labels', permissionKey: PermissionKeys.Catalog.ManageLabels, icon: IconTags },
      { id: 'collections', label: 'Добірки', path: '/catalog/collections', permissionKey: PermissionKeys.Catalog.ManageCollections, icon: IconLayoutGrid },
    ],
  },
  {
    id: 'site',
    label: 'Сайт',
    prefix: '/site',
    items: [
      { id: 'home', label: 'Головна', path: '/site/home', permissionKey: PermissionKeys.Site.ManageHome, icon: IconHome },
      { id: 'banners', label: 'Банери', path: '/site/banners', permissionKey: PermissionKeys.Site.ManageHome, icon: IconPhoto },
      { id: 'pages', label: 'Сторінки', path: '/site/pages', permissionKey: PermissionKeys.Content.ManageSite, icon: IconFileText },
      { id: 'services', label: 'Послуги', path: '/site/services', permissionKey: PermissionKeys.Content.ManageSite, icon: IconTool },
      {
        id: 'seo',
        label: 'SEO',
        path: '/site/seo',
        permissionKey: PermissionKeys.Catalog.ManageRedirects,
        alsoAllowedBy: [PermissionKeys.Site.ManageSeo],
        icon: IconSeo,
      },
    ],
  },
  {
    id: 'settings',
    label: 'Налаштування',
    prefix: '/settings',
    items: [
      { id: 'shop', label: 'Магазин', path: '/settings/shop', permissionKey: PermissionKeys.Settings.ManageShop, icon: IconBuildingStore },
      { id: 'delivery', label: 'Доставка', path: '/settings/delivery', permissionKey: PermissionKeys.Content.ManagePickup, icon: IconTruckDelivery },
      { id: 'payments', label: 'Оплата й чеки', path: '/settings/payments', permissionKey: PermissionKeys.Integration.ViewStatus, icon: IconCreditCard },
      { id: 'notifications', label: 'Сповіщення', path: '/settings/notifications', permissionKey: PermissionKeys.Settings.ManageNotifications, icon: IconBell },
    ],
  },
  {
    id: 'system',
    label: 'Система',
    prefix: '/system',
    items: [
      {
        id: 'integrations',
        label: 'Інтеграції',
        path: '/system/integrations',
        permissionKey: PermissionKeys.Integration.ViewStatus,
        icon: IconPlugConnected,
        badge: (summary) => summary.failedOperations,
        badgeTone: 'bad',
      },
      { id: 'staff', label: 'Працівники', path: '/system/staff', permissionKey: PermissionKeys.Staff.ManageUsers, icon: IconUserCog },
      { id: 'roles', label: 'Ролі і права', path: '/system/roles', permissionKey: PermissionKeys.Staff.ManageRoles, icon: IconShieldLock },
      { id: 'audit', label: 'Журнал', path: '/system/audit', permissionKey: PermissionKeys.Audit.View, icon: IconHistory },
    ],
  },
]

export function isNavItemAllowed(item: NavItem, has: (key: PermissionKey) => boolean): boolean {
  return has(item.permissionKey) || (item.alsoAllowedBy?.some(has) ?? false)
}

export function matchesPath(itemPath: string, pathname: string): boolean {
  if (itemPath === '/') return pathname === '/'
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

export function findActive(sections: readonly NavSection[], pathname: string): { section: NavSection; item: NavItem | null } | null {
  let best: { section: NavSection; item: NavItem } | null = null
  for (const section of sections) {
    for (const item of section.items) {
      if (matchesPath(item.path, pathname) && (!best || item.path.length > best.item.path.length)) best = { section, item }
    }
  }
  if (best) return best
  const section = sections.find((candidate) => candidate.prefix && matchesPath(candidate.prefix, pathname))
  return section ? { section, item: null } : null
}

export function sectionByPrefix(sections: readonly NavSection[], prefix: string): NavSection | null {
  return sections.find((section) => section.prefix === prefix) ?? null
}
