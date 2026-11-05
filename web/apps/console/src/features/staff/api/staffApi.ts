import type { components } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'
import type { CsrfHeaders } from '@/shared/api/csrf'

type S = components['schemas']

export type StaffUser = S['StaffUserDto']
export type CreateStaffUserRequest = S['CreateStaffUserRequest']
export type UpdateStaffUserRequest = S['UpdateStaffUserRequest']

export function getStaffUsers() {
  return api.GET('/api/v1/console/users')
}

export function createStaffUser(headers: CsrfHeaders, body: CreateStaffUserRequest) {
  return api.POST('/api/v1/console/users', { headers, body })
}

export function updateStaffUser(headers: CsrfHeaders, id: string, body: UpdateStaffUserRequest) {
  return api.PUT('/api/v1/console/users/{id}', { params: { path: { id } }, headers, body })
}

export function lockStaffUser(headers: CsrfHeaders, id: string, locked: boolean) {
  return api.POST('/api/v1/console/users/{id}/lock', { params: { path: { id } }, headers, body: { locked } })
}

export function resetStaffPassword(headers: CsrfHeaders, id: string, password: string) {
  return api.POST('/api/v1/console/users/{id}/password', { params: { path: { id } }, headers, body: { password } })
}
