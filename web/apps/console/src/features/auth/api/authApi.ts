import type { components } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'
import type { CsrfHeaders } from '@/shared/api/csrf'

type S = components['schemas']

export function getMe() {
  return api.GET('/api/v1/console/auth/me')
}

export function login(body: S['LoginRequest']) {
  return api.POST('/api/v1/console/auth/login', { body })
}

export function logout(headers: CsrfHeaders) {
  return api.POST('/api/v1/console/auth/logout', { headers })
}

export function changeOwnPassword(headers: CsrfHeaders, body: S['ChangeOwnPasswordRequest']) {
  return api.POST('/api/v1/console/auth/password', { headers, body })
}
