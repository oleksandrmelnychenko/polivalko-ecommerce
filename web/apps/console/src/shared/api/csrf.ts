import { problemOf } from '@polivalko/shared/api/problem'
import { api } from './client'

let csrfToken: Promise<string> | null = null

async function loadToken(): Promise<string> {
  const { data } = await api.GET('/api/v1/console/auth/csrf')
  return data?.token ?? ''
}

export async function csrfHeader(): Promise<{ 'X-CSRF-TOKEN': string }> {
  csrfToken ??= loadToken().catch((error: unknown) => {
    csrfToken = null
    throw error
  })
  return { 'X-CSRF-TOKEN': await csrfToken }
}

export function forgetCsrf(): void {
  csrfToken = null
}

export type CsrfHeaders = Awaited<ReturnType<typeof csrfHeader>>

export async function withCsrf<R extends { error?: unknown }>(send: (headers: CsrfHeaders) => Promise<R>): Promise<R> {
  let result = await send(await csrfHeader())
  if (problemOf(result)?.code === 'auth.csrf_invalid') {
    forgetCsrf()
    result = await send(await csrfHeader())
  }
  return result
}
