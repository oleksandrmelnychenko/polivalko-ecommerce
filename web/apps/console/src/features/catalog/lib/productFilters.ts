import { DEFAULT_PAGE_SIZE, normalizePageSize } from '@/shared/ui/paginator/pageSize'
import type { ProductFill, ProductsQuery } from '../api/catalogApi'

export const FILTER_KEYS = ['q', 'categoryId', 'stock', 'visible', 'brand', 'labelId', 'fill', 'newDays', 'hiddenWithStock'] as const

export type FilterKey = (typeof FILTER_KEYS)[number]
export type ParamKey = FilterKey | 'page' | 'pageSize'

export type ProductsState = Record<FilterKey, string> & {
  page: number
  pageSize: number
}

export type ProductsTab = 'all' | 'fill' | 'new' | 'hidden' | 'out'

export const NEW_PRODUCT_DAYS = 30

export const STOCK_OPTIONS = [
  { value: 'in', label: 'Є в наявності' },
  { value: 'low', label: 'Закінчується (до 3)' },
  { value: 'out', label: 'Немає' },
]

export const VISIBLE_OPTIONS = [
  { value: 'true', label: 'Показуються' },
  { value: 'false', label: 'Приховані' },
]

export const FILL_OPTIONS: { value: ProductFill; label: string }[] = [
  { value: 'any-missing', label: 'Чогось бракує' },
  { value: 'missing-photo', label: 'Немає фото' },
  { value: 'missing-description', label: 'Немає опису' },
  { value: 'missing-attributes', label: 'Немає характеристик' },
]

const STOCKS = STOCK_OPTIONS.map((option) => option.value)
const VISIBLE = VISIBLE_OPTIONS.map((option) => option.value)
const FILLS: string[] = FILL_OPTIONS.map((option) => option.value)
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_NEW_DAYS = 3650

function readDays(value: string): string {
  const days = Number(value)
  return Number.isInteger(days) && days > 0 && days <= MAX_NEW_DAYS ? String(days) : ''
}

export function readProductsState(params: URLSearchParams): ProductsState {
  const value = (key: FilterKey) => params.get(key)?.trim() ?? ''
  return {
    q: value('q'),
    categoryId: GUID.test(value('categoryId')) ? value('categoryId') : '',
    stock: STOCKS.includes(value('stock')) ? value('stock') : '',
    visible: VISIBLE.includes(value('visible')) ? value('visible') : '',
    brand: value('brand').slice(0, 200),
    labelId: GUID.test(value('labelId')) ? value('labelId') : '',
    fill: FILLS.includes(value('fill')) ? value('fill') : '',
    newDays: readDays(value('newDays')),
    hiddenWithStock: value('hiddenWithStock') === 'true' ? 'true' : '',
    page: Math.max(Number(params.get('page')) || 1, 1),
    pageSize: normalizePageSize(params.get('pageSize') ?? DEFAULT_PAGE_SIZE),
  }
}

export function hasActiveFilters(state: ProductsState): boolean {
  return FILTER_KEYS.some((key) => state[key] !== '')
}

export function activeFilterCount(state: ProductsState): number {
  return [state.categoryId, state.brand, state.labelId, state.fill, state.stock, state.visible].filter(Boolean).length
}

export function activeTab(state: ProductsState): ProductsTab {
  if (state.hiddenWithStock) return 'hidden'
  if (state.newDays) return 'new'
  if (state.fill) return 'fill'
  if (state.stock === 'out') return 'out'
  return 'all'
}

export function tabPatch(state: ProductsState, tab: ProductsTab): Partial<Record<FilterKey, string | null>> {
  return {
    fill: tab === 'fill' ? 'any-missing' : null,
    newDays: tab === 'new' ? String(NEW_PRODUCT_DAYS) : null,
    hiddenWithStock: tab === 'hidden' ? 'true' : null,
    stock: tab === 'out' ? 'out' : state.stock === 'out' ? null : state.stock,
  }
}

export function toProductsQuery(state: ProductsState): ProductsQuery {
  return {
    q: state.q || undefined,
    categoryId: state.categoryId || undefined,
    visible: state.visible === '' ? undefined : state.visible === 'true',
    stock: state.stock || undefined,
    brand: state.brand || undefined,
    labelId: state.labelId || undefined,
    fill: (state.fill || undefined) as ProductFill | undefined,
    newDays: state.newDays ? Number(state.newDays) : undefined,
    hiddenWithStock: state.hiddenWithStock ? true : undefined,
    page: state.page,
    pageSize: state.pageSize,
  }
}

export function productHref(id: string): string {
  return `/catalog/products/${encodeURIComponent(id)}`
}

export function productName(product: { displayName: string | null; name: string }): string {
  return product.displayName ?? product.name
}
