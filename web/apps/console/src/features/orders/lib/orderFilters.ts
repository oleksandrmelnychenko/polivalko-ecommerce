import type { OrderStatus, PaymentStatus } from '@polivalko/shared/api/types'
import { orderStatusLabel, paymentStatusLabel } from '@polivalko/shared/lib/labels'
import type { DataTableSortingState } from '@/shared/ui/data-table/types'
import { DEFAULT_PAGE_SIZE, normalizePageSize } from '@/shared/ui/paginator/pageSize'

export const FILTER_KEYS = ['q', 'status', 'paymentStatus', 'delivery', 'from', 'to'] as const

export type FilterKey = (typeof FILTER_KEYS)[number]
export type OrderSort = 'newest' | 'oldest' | 'totalDesc' | 'totalAsc'
export type ParamKey = FilterKey | 'sort' | 'page' | 'pageSize'

export type OrdersState = Record<FilterKey, string> & {
  sort: OrderSort
  page: number
  pageSize: number
}

const SORTS: readonly OrderSort[] = ['newest', 'oldest', 'totalDesc', 'totalAsc']
const ORDER_STATUSES = Object.keys(orderStatusLabel) as OrderStatus[]
const PAYMENT_STATUSES = Object.keys(paymentStatusLabel) as PaymentStatus[]

export const SORT_COLUMN = { date: 'createdAt', total: 'total' } as const

export function readOrdersState(params: URLSearchParams): OrdersState {
  const value = (key: FilterKey) => params.get(key) ?? ''
  const status = value('status')
  const paymentStatus = value('paymentStatus')
  const sort = params.get('sort') as OrderSort | null
  return {
    q: value('q'),
    status: ORDER_STATUSES.includes(status as OrderStatus) ? status : '',
    paymentStatus: PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus) ? paymentStatus : '',
    delivery: value('delivery'),
    from: isIsoDate(value('from')) ? value('from') : '',
    to: isIsoDate(value('to')) ? value('to') : '',
    sort: sort && SORTS.includes(sort) ? sort : 'newest',
    page: Math.max(Number(params.get('page')) || 1, 1),
    pageSize: normalizePageSize(params.get('pageSize') ?? DEFAULT_PAGE_SIZE),
  }
}

export function hasActiveFilters(state: OrdersState): boolean {
  return FILTER_KEYS.some((key) => key !== 'status' && state[key] !== '')
}

export function toApiFilters(state: OrdersState) {
  return {
    q: state.q || undefined,
    paymentStatus: (state.paymentStatus || undefined) as PaymentStatus | undefined,
    delivery: state.delivery || undefined,
    from: state.from || undefined,
    to: state.to || undefined,
  }
}

export function toListQuery(state: OrdersState) {
  return {
    ...toApiFilters(state),
    status: (state.status || undefined) as OrderStatus | undefined,
    sort: state.sort === 'newest' ? undefined : state.sort,
    page: state.page,
    pageSize: state.pageSize,
  }
}

export function sortToSorting(sort: OrderSort): DataTableSortingState {
  switch (sort) {
    case 'oldest':
      return [{ id: SORT_COLUMN.date, desc: false }]
    case 'totalDesc':
      return [{ id: SORT_COLUMN.total, desc: true }]
    case 'totalAsc':
      return [{ id: SORT_COLUMN.total, desc: false }]
    default:
      return [{ id: SORT_COLUMN.date, desc: true }]
  }
}

export function sortingToSort(sorting: DataTableSortingState): OrderSort {
  const first = sorting[0]
  if (!first) return 'newest'
  if (first.id === SORT_COLUMN.total) return first.desc ? 'totalDesc' : 'totalAsc'
  return first.desc ? 'newest' : 'oldest'
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function orderHref(number: string): string {
  return `/sales/orders/${encodeURIComponent(number)}`
}
