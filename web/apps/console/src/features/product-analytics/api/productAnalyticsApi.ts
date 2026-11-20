import type { components, paths } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'

type Schemas = components['schemas']
type Query = NonNullable<paths['/api/v1/console/product-analytics']['get']['parameters']['query']>

export type ProductAnalytics = Schemas['ProductAnalyticsDto']
export type AnalyticsSource = 'web' | 'dntrade'

export function getProductAnalytics(query: Query) {
  return api.GET('/api/v1/console/product-analytics', { params: { query } })
}
