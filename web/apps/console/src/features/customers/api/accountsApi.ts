import type { components, paths } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'
import type { CsrfHeaders } from '@/shared/api/csrf'

type S = components['schemas']

export type AccountStatusFilter = 'all' | 'confirmed' | 'unconfirmed' | 'locked'
export type AccountRow = S['ConsoleAccountDto']
export type AccountDetails = S['ConsoleAccountDetailsDto']
export type AccountAddress = S['CustomerAddressDto']
export type AccountOrder = S['ConsoleAccountOrderDto']
export type AccountsQuery = NonNullable<paths['/api/v1/console/accounts']['get']['parameters']['query']>

export function getAccounts(query: AccountsQuery) {
  return api.GET('/api/v1/console/accounts', { params: { query } })
}

export function getAccount(id: string) {
  return api.GET('/api/v1/console/accounts/{id}', { params: { path: { id } } })
}

export function lockAccount(headers: CsrfHeaders, id: string, locked: boolean) {
  return api.POST('/api/v1/console/accounts/{id}/lock', { params: { path: { id } }, headers, body: { locked } })
}

export function sendPasswordReset(headers: CsrfHeaders, id: string) {
  return api.POST('/api/v1/console/accounts/{id}/password-reset', { params: { path: { id } }, headers })
}
