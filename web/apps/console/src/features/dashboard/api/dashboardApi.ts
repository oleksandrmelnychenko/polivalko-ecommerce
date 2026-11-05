import type { components } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'

type S = components['schemas']

export type Dashboard = S['ConsoleDashboardDto']
export type DashboardDay = S['DashboardDayDto']
export type DashboardSummary = S['ConsoleSummaryDto']
export type LatestOrder = S['ConsoleOrderListItemDto']

export type ProductCounts = S['ConsoleProductCountsDto']

export function getDashboard(days: number) {
  return api.GET('/api/v1/console/dashboard', { params: { query: { days } } })
}

export function getDashboardSummary() {
  return api.GET('/api/v1/console/summary')
}

export function getLatestOrders() {
  return api.GET('/api/v1/console/orders', { params: { query: { page: 1, pageSize: 6 } } })
}

export function getProductCounts() {
  return api.GET('/api/v1/console/catalog/products/counts')
}
