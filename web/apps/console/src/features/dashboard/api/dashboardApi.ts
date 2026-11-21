import type { components } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'
import { readBusiness } from '@/shared/api/readBusiness'

type S = components['schemas']

export type Dashboard = S['ConsoleDashboardDto']
export type DashboardDay = S['DashboardDayDto']
export type DashboardSummary = S['ConsoleSummaryDto']
export type LatestOrder = S['ConsoleOrderListItemDto']

type SalesTotals = {
  invoices: number; receipts: number; refunds: number; purchases: number
  gross: number; returned: number; net: number
}
export type DocumentSales = {
  start: string; through: string; latest: string | null; days: number
  current: SalesTotals; previous: SalesTotals; excluded: number; incompleteProducts: number
  byDay: { day: string; net: number; purchases: number }[]
  products: { name: string; sku: string; net: number }[]
}

export const getDocumentSales = (days: number) =>
  readBusiness<DocumentSales>('documents', 'analysis=dashboard&days=' + days)

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

export function getDashboardCustomers() {
  return api.GET('/api/v1/console/customers', { params: { query: { page: 1, pageSize: 1 } } })
}

export function getDashboardRequests() {
  return api.GET('/api/v1/console/service-requests', { params: { query: { page: 1, pageSize: 1 } } })
}
