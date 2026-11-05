import type { components, paths } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'
import type { CsrfHeaders } from '@/shared/api/csrf'
import type { ApiResult } from '@/shared/api/useApiQuery'

export type RequestsQuery = NonNullable<paths['/api/v1/console/service-requests']['get']['parameters']['query']>
export type ServiceRequest = components['schemas']['ConsoleServiceRequestDto']
export type RequestStatus = components['schemas']['ServiceRequestStatus']
export type RequestCounts = { all: number; byStatus: Record<RequestStatus, number> }

export const REQUEST_STATUSES: readonly RequestStatus[] = ['new', 'inProgress', 'done']

export function getServiceRequests(query: RequestsQuery) {
  return api.GET('/api/v1/console/service-requests', { params: { query } })
}

export async function getServiceRequestCounts(): Promise<ApiResult<RequestCounts>> {
  const results = await Promise.all(REQUEST_STATUSES.map((status) => getServiceRequests({ status, page: 1, pageSize: 1 })))
  const failed = results.find((result) => !result.response.ok)
  if (failed) return { error: failed.error, response: failed.response }
  const byStatus = Object.fromEntries(REQUEST_STATUSES.map((status, index) => [status, results[index].data?.totalItems ?? 0])) as Record<RequestStatus, number>
  const all = REQUEST_STATUSES.reduce((sum, status) => sum + byStatus[status], 0)
  return { data: { all, byStatus }, response: results[0].response }
}

export function changeServiceRequestStatus(headers: CsrfHeaders, id: string, status: RequestStatus) {
  return api.POST('/api/v1/console/service-requests/{id}/status', { params: { path: { id } }, headers, body: { status } })
}
