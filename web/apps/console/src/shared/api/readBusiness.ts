import { apiFetch } from './client'

export async function readBusiness<T>(op: string, params = '') {
  const response = await apiFetch('/api/v1/console/business-analytics/' + op + (params ? '?' + params : ''), {
    cache: 'no-store',
  })
  const body = await response.json()
  return { response, data: response.ok ? (body as T) : undefined, error: response.ok ? undefined : body }
}
