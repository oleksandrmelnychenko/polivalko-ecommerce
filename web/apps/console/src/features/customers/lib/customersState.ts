import type { DataTableSortingState } from '@/shared/ui/data-table/types'
import { DEFAULT_PAGE_SIZE, normalizePageSize } from '@/shared/ui/paginator/pageSize'

export type CustomerSort = 'lastOrder' | 'totalSpent' | 'orders'
export type CustomersParam = 'q' | 'sort' | 'page' | 'pageSize'

export type CustomersState = {
  q: string
  sort: CustomerSort
  page: number
  pageSize: number
}

export const DEFAULT_SORT: CustomerSort = 'lastOrder'

export const sortLabel: Record<CustomerSort, string> = {
  lastOrder: 'Останнє замовлення',
  totalSpent: 'Сума покупок',
  orders: 'Кількість замовлень',
}

const SORTS = Object.keys(sortLabel) as CustomerSort[]

export const PARAM_DEFAULTS: Partial<Record<CustomersParam, string>> = { sort: DEFAULT_SORT, page: '1', pageSize: String(DEFAULT_PAGE_SIZE) }

export function readCustomersState(params: URLSearchParams): CustomersState {
  const sort = params.get('sort') as CustomerSort | null
  return {
    q: params.get('q') ?? '',
    sort: sort && SORTS.includes(sort) ? sort : DEFAULT_SORT,
    page: Math.max(Number(params.get('page')) || 1, 1),
    pageSize: normalizePageSize(params.get('pageSize') ?? DEFAULT_PAGE_SIZE),
  }
}

export function toCustomersQuery(state: CustomersState) {
  return {
    q: state.q.trim() || undefined,
    sort: state.sort === DEFAULT_SORT ? undefined : state.sort,
    page: state.page,
    pageSize: state.pageSize,
  }
}

export function isCustomerSort(value: string | null | undefined): value is CustomerSort {
  return Boolean(value) && SORTS.includes(value as CustomerSort)
}

export function sortToSorting(sort: CustomerSort): DataTableSortingState {
  return [{ id: sort, desc: true }]
}

export function sortingToSort(sorting: DataTableSortingState): CustomerSort {
  const id = sorting[0]?.id
  return isCustomerSort(id) ? id : DEFAULT_SORT
}

export function ordersOfCustomerHref(phone: string): string {
  return `/sales/orders?q=${encodeURIComponent(phone)}`
}
