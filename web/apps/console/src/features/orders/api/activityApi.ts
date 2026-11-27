import type { components, paths } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'

export type ShopActivityQuery = NonNullable<paths['/api/v1/console/orders/activity']['get']['parameters']['query']>
export type ShopActivityResponse = components['schemas']['ConsoleShopActivityResponse']
export type ShopActivityItem = components['schemas']['ConsoleShopActivityItem']
export type ShopActivitySummary = components['schemas']['ConsoleShopActivitySummary']
export type ShopActivityTopProduct = components['schemas']['ConsoleShopActivityTopProduct']
export type OpenCartRow = components['schemas']['ConsoleOpenCart']

export function getShopActivity(query: ShopActivityQuery) {
  return api.GET('/api/v1/console/orders/activity', { params: { query }, cache: 'no-store' })
}

export function getOpenCarts(page: number) {
  return api.GET('/api/v1/console/orders/open-carts', { params: { query: { page } }, cache: 'no-store' })
}
