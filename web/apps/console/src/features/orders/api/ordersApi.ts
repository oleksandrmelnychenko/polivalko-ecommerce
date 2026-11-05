import type { components, paths } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'
import type { CsrfHeaders } from '@/shared/api/csrf'
import { downloadFile } from '@/shared/api/download'

export type OrdersQuery = NonNullable<paths['/api/v1/console/orders']['get']['parameters']['query']>
export type OrderCountsQuery = NonNullable<paths['/api/v1/console/orders/counts']['get']['parameters']['query']>
export type OrderRow = components['schemas']['ConsoleOrderListItemDto']
export type OrderCounts = components['schemas']['ConsoleOrderCountsDto']
export type ChangeOrderStatusRequest = components['schemas']['ChangeOrderStatusRequest']

export function getOrders(query: OrdersQuery, signal?: AbortSignal) {
  return api.GET('/api/v1/console/orders', { params: { query }, signal })
}

export function getOrderCounts(query: OrderCountsQuery) {
  return api.GET('/api/v1/console/orders/counts', { params: { query } })
}

export function changeOrderStatus(headers: CsrfHeaders, number: string, body: ChangeOrderStatusRequest) {
  return api.POST('/api/v1/console/orders/{number}/status', { params: { path: { number } }, headers, body })
}

export function exportOrders(search: URLSearchParams) {
  const suffix = search.size ? `?${search}` : ''
  return downloadFile(`/api/v1/console/orders/export${suffix}`, 'polivalko-orders.csv')
}
