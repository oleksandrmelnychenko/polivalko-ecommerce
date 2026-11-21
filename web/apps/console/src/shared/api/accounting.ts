import { useEffect } from 'react'
import { apiFetch } from '@/shared/api/client'
import type { components } from '@polivalko/shared/api/schema'
import { withCsrf } from '@/shared/api/csrf'
import { useApiQuery, type ApiResult } from '@/shared/api/useApiQuery'

export type Page<T> = { total: number; items: T[] }
type S = components['schemas']
export type Partner = S['PartnerRow']

export async function read<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await apiFetch('/api/v1/console/accounting/' + path, init)
  return response.ok
    ? { response, data: (await response.json()) as T }
    : { response, error: await response.json().catch(() => undefined) }
}
export const ACCOUNTING_DOCUMENT_CHANGED = 'accounting-document-changed'

export function useRegister<T>(path: string, enabled = true) {
  const query = useApiQuery<T>('accounting:' + path, () => read<T>(path), { enabled })
  const { reload } = query
  useEffect(() => {
    if (!enabled || path.startsWith('documents/')) return
    window.addEventListener(ACCOUNTING_DOCUMENT_CHANGED, reload)
    return () => window.removeEventListener(ACCOUNTING_DOCUMENT_CHANGED, reload)
  }, [enabled, path, reload])
  return query
}
export function save(path: string, body: unknown, method: 'POST' | 'PUT' = 'POST') {
  return withCsrf((headers) =>
    read<string>(path, {
      method,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}
