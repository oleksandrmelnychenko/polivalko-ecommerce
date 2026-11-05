import type { components } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'
import type { CsrfHeaders } from '@/shared/api/csrf'

type S = components['schemas']

export type IntegrationStatus = S['IntegrationStatusDto']
export type SyncJob = S['SyncJobDto']
export type SyncRun = S['ImportRunDto']
export type SyncRunStatus = S['SyncRunStatus']
export type SyncRunError = S['SyncError']
export type OutboxMessage = S['OutboxMessageDto']
export type NovaPoshtaStatus = S['NovaPoshtaStatusDto']

export function getIntegrationStatus() {
  return api.GET('/api/v1/console/integration/status')
}

export function runJob(headers: CsrfHeaders, job: string) {
  return api.POST('/api/v1/console/integration/jobs/{job}/run', { params: { path: { job } }, headers })
}

export function getRuns(job: string | undefined) {
  return api.GET('/api/v1/console/integration/runs', { params: { query: { job } } })
}

export function getOutbox() {
  return api.GET('/api/v1/console/integration/outbox')
}

export function retryOutbox(headers: CsrfHeaders, id: string) {
  return api.POST('/api/v1/console/integration/outbox/{id}/retry', { params: { path: { id } }, headers })
}

export function getNovaPoshta() {
  return api.GET('/api/v1/console/delivery/novaposhta')
}
