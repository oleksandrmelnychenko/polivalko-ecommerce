import type { ComponentType } from 'react'
import { PermissionKeys, type PermissionKey } from '@/shared/auth/permissionKeys'
import * as Pages from './lazyConsolePages'

export type ConsoleRoute = {
  path: string
  title: string
  permissionKey: PermissionKey
  alsoAllowedBy?: readonly PermissionKey[]
  page: ComponentType
  redirectWhenDenied?: boolean
}

export type ConsoleRedirect = {
  from: string
  to: string
}

export const consoleRoutes: readonly ConsoleRoute[] = [
  { path: '/', title: 'Дашборд', permissionKey: PermissionKeys.Dashboard.View, page: Pages.DashboardPage, redirectWhenDenied: true },
  { path: '/sales/orders', title: 'Замовлення', permissionKey: PermissionKeys.Orders.View, page: Pages.OrdersPage },
  { path: '/sales/orders/:number', title: 'Замовлення', permissionKey: PermissionKeys.Orders.View, page: Pages.OrderPage },
  { path: '/sales/requests', title: 'Заявки', permissionKey: PermissionKeys.Requests.View, page: Pages.RequestsPage },
  { path: '/sales/returns', title: 'Повернення', permissionKey: PermissionKeys.Orders.View, page: Pages.ReturnsPage },
  { path: '/sales/customers', title: 'Покупці', permissionKey: PermissionKeys.Customers.View, page: Pages.CustomersPage },
  { path: '/sales/customers/accounts/:id', title: 'Кабінет покупця', permissionKey: PermissionKeys.Customers.View, page: Pages.AccountPage },
  { path: '/catalog/products', title: 'Товари', permissionKey: PermissionKeys.Catalog.ViewProducts, page: Pages.ProductsPage },
  { path: '/catalog/products/:id', title: 'Товар', permissionKey: PermissionKeys.Catalog.ViewProducts, page: Pages.ProductPage },
  { path: '/catalog/categories', title: 'Категорії', permissionKey: PermissionKeys.Catalog.ManageCategories, page: Pages.CategoriesPage },
  { path: '/catalog/attributes', title: 'Характеристики', permissionKey: PermissionKeys.Catalog.ManageAttributes, page: Pages.AttributesPage },
  { path: '/catalog/brands', title: 'Бренди', permissionKey: PermissionKeys.Catalog.ManageBrands, page: Pages.BrandsPage },
  { path: '/catalog/labels', title: 'Мітки', permissionKey: PermissionKeys.Catalog.ManageLabels, page: Pages.LabelsPage },
  { path: '/catalog/collections', title: 'Добірки', permissionKey: PermissionKeys.Catalog.ManageCollections, page: Pages.CollectionsPage },
  { path: '/catalog/import', title: 'Імпорт', permissionKey: PermissionKeys.Catalog.RunImport, page: Pages.ImportPage },
  { path: '/site/home', title: 'Головна', permissionKey: PermissionKeys.Site.ManageHome, page: Pages.HomeSettingsPage },
  { path: '/site/banners', title: 'Банери', permissionKey: PermissionKeys.Site.ManageHome, page: Pages.BannersPage },
  { path: '/site/pages', title: 'Сторінки', permissionKey: PermissionKeys.Content.ManageSite, page: Pages.ContentPagesPage },
  { path: '/site/pages/:slug', title: 'Сторінка', permissionKey: PermissionKeys.Content.ManageSite, page: Pages.ContentPageEditorPage },
  { path: '/site/services', title: 'Послуги', permissionKey: PermissionKeys.Content.ManageSite, page: Pages.ServicesPage },
  {
    path: '/site/seo',
    title: 'SEO',
    permissionKey: PermissionKeys.Catalog.ManageRedirects,
    alsoAllowedBy: [PermissionKeys.Site.ManageSeo],
    page: Pages.SeoPage,
  },
  { path: '/settings/shop', title: 'Магазин', permissionKey: PermissionKeys.Settings.ManageShop, page: Pages.ShopSettingsPage },
  { path: '/settings/delivery', title: 'Доставка', permissionKey: PermissionKeys.Content.ManagePickup, page: Pages.DeliverySettingsPage },
  { path: '/settings/payments', title: 'Оплата й чеки', permissionKey: PermissionKeys.Integration.ViewStatus, page: Pages.PaymentSettingsPage },
  { path: '/settings/notifications', title: 'Сповіщення', permissionKey: PermissionKeys.Settings.ManageNotifications, page: Pages.NotificationSettingsPage },
  { path: '/system/integrations', title: 'Інтеграції', permissionKey: PermissionKeys.Integration.ViewStatus, page: Pages.IntegrationPage },
  { path: '/system/staff', title: 'Працівники', permissionKey: PermissionKeys.Staff.ManageUsers, page: Pages.StaffPage },
  { path: '/system/roles', title: 'Ролі і права', permissionKey: PermissionKeys.Staff.ManageRoles, page: Pages.RolesPage },
  { path: '/system/audit', title: 'Журнал', permissionKey: PermissionKeys.Audit.View, page: Pages.AuditPage },
]

export const consoleRedirects: readonly ConsoleRedirect[] = [
  { from: '/orders', to: '/sales/orders' },
  { from: '/orders/:number', to: '/sales/orders/:number' },
  { from: '/customers', to: '/sales/customers' },
  { from: '/requests', to: '/sales/requests' },
  { from: '/catalog/redirects', to: '/site/seo?tab=redirects' },
  { from: '/content', to: '/site/pages' },
  { from: '/content/pages', to: '/site/pages' },
  { from: '/content/pages/:slug', to: '/site/pages/:slug' },
  { from: '/content/services', to: '/site/services' },
  { from: '/content/contacts', to: '/settings/shop' },
  { from: '/content/pickup', to: '/settings/delivery' },
  { from: '/integration', to: '/system/integrations' },
  { from: '/audit', to: '/system/audit' },
  { from: '/staff', to: '/system/staff' },
  { from: '/staff/roles', to: '/system/roles' },
]

export const sectionRedirects: readonly string[] = ['/sales', '/catalog', '/site', '/settings', '/system']

export function redirectTarget(to: string, params: Readonly<Record<string, string | undefined>>, search: string, hash: string): string {
  const [pathPart, queryPart = ''] = to.split('?')
  const path = pathPart.replace(/:([A-Za-z]+)/g, (_, name: string) => encodeURIComponent(params[name] ?? ''))
  const query = new URLSearchParams(queryPart)
  const fixed = new Set(query.keys())
  new URLSearchParams(search).forEach((value, key) => {
    if (!fixed.has(key)) query.append(key, value)
  })
  const text = query.toString()
  return `${path}${text ? `?${text}` : ''}${hash}`
}
