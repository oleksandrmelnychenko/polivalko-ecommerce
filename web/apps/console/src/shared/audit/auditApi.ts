import type { components, paths } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'

export type AuditQuery = NonNullable<paths['/api/v1/console/audit']['get']['parameters']['query']>
export type AuditEntry = components['schemas']['AuditEntryDto']

export function getAudit(query: AuditQuery) {
  return api.GET('/api/v1/console/audit', { params: { query } })
}
