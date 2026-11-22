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
  products: { name: string; sku: string; net: number; code: string | null; account: string; share: number | null;
    abc: 'A' | 'B' | 'C' | null; profit: number | null; margin: number | null; cost: number | null;
    costedLines: number; lines: number; coveredNet: number; coveredCost: number;
    purchaseSources: { id: string; number: string | null; day: string }[] }[]
}

type ProfitReport = { available: false } | { available: true; start: string; through: string; total: number;
  net: number; profit: number; matches: number; lossCount: number; page: number;
  rows: { code: string; name: string; net: number; cost: number; profit: number; share: number | null; margin: number | null }[] }

export const getProductProfit = (params: URLSearchParams) =>
  readBusiness<ProfitReport>('documents', 'analysis=product-profit&' + params)

export const getDocumentSales = (days: number) =>
  readBusiness<DocumentSales>('documents', 'analysis=dashboard&days=' + days)

export type SupplierDelivery = {
  id: string; number: string | null; day: string; eta: string | null; unit: string
  ordered: number; received: number | null; remaining: number | null
  state: 'confirmed' | 'shipped' | 'review'
  timing: 'other-store' | 'units' | 'review' | 'undated' | 'overdue' | 'later' | 'within'
}
export type SupplierSupply = { confirmed: number; inTransit: number; within: number; orders: SupplierDelivery[] }
export type LastPurchase = {
  day: string; documentId: string | null; number: string | null; supplier: string | null
  unit: string | null; unitPrice: number | null; amount: number | null; issue: 'ambiguous' | 'unit' | 'price' | null
}
export type PurchaseSeason = { source: 'product' | 'category'; years: number; factor: number }
export type BudgetItem = {
  id: string; sku: string; name: string; quantity: number; unit: string; unitPrice: number | null; amount: number | null
  priceDay: string | null; receiptId: string | null; season?: PurchaseSeason | null
}
export type SupplierGroup = { id: string | null; name: string | null; subtotal: number; unpriced: number; items: BudgetItem[] }
export type SupplierBudget = {
  subtotal: number; unpriced: number; historicalCount: number; historicalAmount: number
  suppliers: SupplierGroup[]
}

type StockTurnoverReport = {
  seasonal?: boolean
  seasonalReview?: number
  // Sales documents of the period whose lines do not add up; any of them leaves every product without confirmed sales.
  incompleteSales?: number
  supplyReview?: number
  // The same counters for the rows the search leaves.
  counts?: { all: number; buy: number; supplyReview: number; seasonReview: number; ordered: number; out: number; low: number }
  start: string
  // The last whole day of the sales period; asOf is the day the plan is made, one day later.
  through: string
  asOf?: string
  periodNet: number
  threshold: number
  coverDays: number
  buyCount: number
  supplierSource: { documents: number; latest: string | null }
  supplierBudget: SupplierBudget
  withOrders: number
  withDatedSupply: number
  total: number
  lowCount: number
  outCount: number
  net: number | null
  share: number | null
  unknownCount: number
  matches: number
  page: number
  pageSize: number
  rows: ({
    id: string
    name: string
    sku: string
    onHand: number
    reserved: number
    available: number
    net: number | null
    share: number | null
    unit: string | null
    dailyRate: number | null
    season?: PurchaseSeason | null
    historicalDemand?: number
    historicalSeasons?: number
    stockDays: number | null
    margin: number | null
    need: number | null
    needBeforeIncoming: number | null
    minimumNeed: number | null
    supply: SupplierSupply
    lastPurchase: LastPurchase | null
  } & (
    { purchaseStatus: 'buy'; buyQuantity: number; priorityProfit: number } |
    { purchaseStatus: 'covered' | 'incoming' | 'supply-review' | 'season-review' | 'no-demand' | 'sales' | 'units' | 'price' | 'cost' | 'reserves'; buyQuantity: null; priorityProfit: null }
  ))[]
}

export const getStockTurnover = (params: URLSearchParams) =>
  readBusiness<StockTurnoverReport>('documents', 'analysis=stock-turnover&' + params)

export type ClientSuggestion = {
  id: string; name: string; sku: string; unit: string; quantity: number; available: number; price: number; amount: number
  requested: number; rank: number; buyers: number; dueOn: string | null; held?: number
  offerId?: string | null; offerStatus?: OfferStatus | null
  purchases: number; last: string; interval: number | null; seasons: number; signal: 'due' | 'repeat' | 'season' | 'single'
}
export type SuggestedClient = { id: string; name: string; lastSale: string; items: ClientSuggestion[] }
export type OfferStatus = 'offered' | 'reserved' | 'declined' | 'released' | 'fulfilled'
export type RecommendationOffer = {
  id: string; client: string; customer: string; product: string; name: string; sku: string; last: string
  quantity: number; unit: string; price: number; status: OfferStatus; offeredAt: string; changedAt: string
  invoiceId: string | null; hasWarehouseSource: boolean
}

export const getClientRecommendations = (days: number) =>
  readBusiness<{ start: string; through: string; active: number; offeredClients: number; clients: SuggestedClient[]; offers?: RecommendationOffer[] }>(
    'documents', 'analysis=customer-recommendations&days=' + days)

type RecommendationMetrics = {
  offered: number; accepted: number; sold: number; invoices: number; conversionRate: number | null
  // Invoices posted in the period whose offer was made before it: they add turnover without adding to the conversion.
  earlierInvoices?: number
  turnover: number; profit: number | null; coveredProfit: number; priced: number; estimated: number
}
export type RecommendationGroup = RecommendationMetrics & { id: string; name: string; sku?: string | null }
export type RecommendationPeriod = RecommendationMetrics & {
  days: number; start: string; customers: RecommendationGroup[]; products: RecommendationGroup[]
}
export type RecommendationResultsReport = {
  through: string; periods: RecommendationPeriod[]
  // day is the date written on the invoice; soldDay is the day it was posted, which decides the period.
  invoices: { id: string; number: string; day: string; soldDay?: string; turnover: number; profit: number | null; estimated: boolean }[]
}
export const getRecommendationResults = () => readBusiness<RecommendationResultsReport>('documents', 'analysis=recommendation-results')

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
