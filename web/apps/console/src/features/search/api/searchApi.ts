import { api } from '@/shared/api/client'

export function searchConsole(q: string, signal?: AbortSignal) {
  return api.GET('/api/v1/console/search', { params: { query: { q } }, signal })
}
