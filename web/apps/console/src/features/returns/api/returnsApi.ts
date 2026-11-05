import type { components, paths } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'

export type RefundRow = components['schemas']['ConsoleRefundRowDto']
export type RefundRowStatus = components['schemas']['RefundStatus']
export type RefundChannel = components['schemas']['RefundChannel']
export type RefundsQuery = NonNullable<paths['/api/v1/console/refunds']['get']['parameters']['query']>

export const REFUND_STATUSES: readonly RefundRowStatus[] = ['pending', 'succeeded', 'failed']

export function getRefunds(query: RefundsQuery) {
  return api.GET('/api/v1/console/refunds', { params: { query } })
}
