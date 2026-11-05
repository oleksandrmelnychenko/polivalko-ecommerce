import { browserApi } from '@polivalko/shared/api/browser'
import { emitConsoleEvent } from '../lib/events'

export const api = browserApi

const SELF_HANDLED_401 = ['/api/v1/console/auth/login', '/api/v1/console/auth/password']

let installed = false

function reportUnauthorized(url: string, status: number): void {
  if (status !== 401) return
  const { pathname } = new URL(url, window.location.origin)
  if (SELF_HANDLED_401.includes(pathname)) return
  emitConsoleEvent('unauthorized')
}

export function installApiMiddleware(): void {
  if (installed) return
  installed = true
  browserApi.use({
    onResponse({ request, response }) {
      reportUnauthorized(request.url, response.status)
      return undefined
    },
  })
}

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, { credentials: 'same-origin', ...init })
  reportUnauthorized(url, response.status)
  return response
}
