import type { components } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'

export type OrderListItem = components['schemas']['ConsoleOrderListItemDto']
export type RefundListItem = components['schemas']['ConsoleRefundRowDto']
export type AccountListItem = components['schemas']['ConsoleAccountDto']

export function findOrders(q: string, pageSize = 5) {
  return api.GET('/api/v1/console/orders', { params: { query: { q, page: 1, pageSize } } })
}

export function findRefunds(q: string, pageSize = 20) {
  return api.GET('/api/v1/console/refunds', { params: { query: { q, page: 1, pageSize } } })
}

export function findAccounts(q: string, pageSize = 5) {
  return api.GET('/api/v1/console/accounts', { params: { query: { q, page: 1, pageSize } } })
}

export function orderHref(number: string): string {
  return `/sales/orders/${encodeURIComponent(number)}`
}

export function ordersSearchHref(q: string): string {
  return `/sales/orders?q=${encodeURIComponent(q)}`
}
