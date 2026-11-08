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

export type TwoFactorStatus = S['TwoFactorStatusDto']
export type TwoFactorSetup = S['TwoFactorSetupDto']

export function getTwoFactorStatus() {
  return api.GET('/api/v1/console/auth/two-factor')
}

export function startTwoFactorSetup(headers: CsrfHeaders) {
  return api.POST('/api/v1/console/auth/two-factor/setup', { headers })
}

export function enableTwoFactor(headers: CsrfHeaders, code: string) {
  return api.POST('/api/v1/console/auth/two-factor/enable', { headers, body: { code } })
}

export function regenerateRecoveryCodes(headers: CsrfHeaders, code: string) {
  return api.POST('/api/v1/console/auth/two-factor/recovery-codes', { headers, body: { code } })
}

export function disableTwoFactor(headers: CsrfHeaders, code: string) {
  return api.POST('/api/v1/console/auth/two-factor/disable', { headers, body: { code } })
}
