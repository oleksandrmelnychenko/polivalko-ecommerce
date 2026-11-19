import type { components, paths } from '@polivalko/shared/api/schema'
import { api, apiFetch } from '@/shared/api/client'
import { withCsrf } from '@/shared/api/csrf'
import type { ApiResult } from '@/shared/api/useApiQuery'

const ARCHIVE_API = '/api/v1/console/dntrade-archive'

export type ArchiveItem = components['schemas']['DnTradeArchiveItemDto']
export type ArchiveImport = components['schemas']['DnTradeArchiveImportDto']
export type ArchiveQuery = NonNullable<paths[typeof ARCHIVE_API]['get']['parameters']['query']>

export function getArchive(query: ArchiveQuery) {
  return api.GET(ARCHIVE_API, { params: { query } })
}

export function getArchiveDetail(id: string) {
  return api.GET('/api/v1/console/dntrade-archive/{id}', { params: { path: { id } } })
}

export function archiveOriginalHref(id: string) {
  return ARCHIVE_API + '/' + encodeURIComponent(id) + '/original'
}

export function importArchive(sourceAccount: string, file: File) {
  const query = new URLSearchParams({ sourceAccount })
  return withCsrf<ApiResult<ArchiveImport>>(async (headers) => {
    const response = await apiFetch(`${ARCHIVE_API}/import?${query}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-ndjson' },
      body: file,
    })
    if (response.ok) return { data: (await response.json()) as ArchiveImport, response }
    return { error: await response.json().catch(() => undefined), response }
  })
}
