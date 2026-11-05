import type { Problem } from '@polivalko/shared/api/problem'
import type { components } from '@polivalko/shared/api/schema'
import { api, apiFetch } from '@/shared/api/client'
import { csrfHeader, forgetCsrf, type CsrfHeaders } from '@/shared/api/csrf'

type S = components['schemas']

export type PageListItem = S['ConsolePageListItemDto']
export type ContentPage = S['PageDto']
export type SavePageRequest = S['SavePageRequest']
export type ServiceDirection = S['ConsoleServiceDirectionDto']
export type SaveServiceDirectionRequest = S['SaveServiceDirectionRequest']
export type UploadedImage = S['UploadedImageDto']

export function getPages() {
  return api.GET('/api/v1/console/content/pages')
}

export function getPage(slug: string) {
  return api.GET('/api/v1/console/content/pages/{slug}', { params: { path: { slug } } })
}

export function savePage(headers: CsrfHeaders, slug: string, body: SavePageRequest) {
  return api.PUT('/api/v1/console/content/pages/{slug}', { params: { path: { slug } }, headers, body })
}

export function getServices() {
  return api.GET('/api/v1/console/content/services')
}

export function saveService(headers: CsrfHeaders, code: string, body: SaveServiceDirectionRequest) {
  return api.PUT('/api/v1/console/content/services/{code}', { params: { path: { code } }, headers, body })
}

export async function uploadImage(file: File): Promise<{ data?: UploadedImage; error?: Problem; response: Response }> {
  const send = async () => {
    const data = new FormData()
    data.set('file', file)
    return apiFetch('/api/v1/console/media/images', { method: 'POST', body: data, headers: await csrfHeader() })
  }
  let response = await send()
  if (response.status === 400) {
    const problem = (await response
      .clone()
      .json()
      .catch(() => null)) as Problem | null
    if (problem?.code === 'auth.csrf_invalid') {
      forgetCsrf()
      response = await send()
    }
  }
  const payload = (await response.json().catch(() => undefined)) as unknown
  return response.ok ? { data: payload as UploadedImage, response } : { error: payload as Problem | undefined, response }
}
