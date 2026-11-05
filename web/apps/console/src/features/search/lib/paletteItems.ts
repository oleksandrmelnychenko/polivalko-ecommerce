import { IconPackage, IconShoppingBag, IconUser, type Icon } from '@tabler/icons-react'
import type { components } from '@polivalko/shared/api/schema'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { orderStatusLabel } from '@polivalko/shared/lib/labels'
import type { NavSection } from '@/features/navigation'

export type SearchResult = components['schemas']['ConsoleSearchDto']

export type PaletteItem = {
  key: string
  href: string
  icon: Icon
  image?: string | null
  title: string
  sub: string
  side?: string
}

export type PaletteGroup = { title: string; items: PaletteItem[] }

export const MIN_TERM_LENGTH = 2

export function paletteGroups(term: string, sections: NavSection[], result: SearchResult | null): PaletteGroup[] {
  if (term.length < MIN_TERM_LENGTH) {
    return sections.map((section) => ({
      title: section.label,
      items: section.items.map((item) => ({ key: `nav-${item.id}`, href: item.path, icon: item.icon, title: item.label, sub: item.path })),
    }))
  }
  if (!result) return []
  const groups: PaletteGroup[] = []
  if (result.orders.length) {
    groups.push({
      title: 'Замовлення',
      items: result.orders.map((order) => ({
        key: `o-${order.number}`,
        href: `/sales/orders/${encodeURIComponent(order.number)}`,
        icon: IconShoppingBag,
        title: `${order.number} · ${order.customerName}`,
        sub: `${orderStatusLabel[order.status]} · ${formatDateTime(order.createdAt)} · ${order.phone}`,
        side: formatMoney(order.total),
      })),
    })
  }
  if (result.products.length) {
    groups.push({
      title: 'Товари',
      items: result.products.map((product) => ({
        key: `p-${product.id}`,
        href: `/catalog/products/${product.id}`,
        icon: IconPackage,
        image: product.imageUrl,
        title: product.name,
        sub: `${product.sku}${product.isVisible ? '' : ' · прихований'}`,
        side: formatMoney(product.price),
      })),
    })
  }
  if (result.customers.length) {
    groups.push({
      title: 'Покупці',
      items: result.customers.map((customer) => ({
        key: `c-${customer.phone}`,
        href: `/sales/orders?q=${encodeURIComponent(customer.phone)}`,
        icon: IconUser,
        title: customer.name,
        sub: customer.phone,
        side: `${customer.orders} замовл.`,
      })),
    })
  }
  return groups
}
