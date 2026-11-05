import type { Problem } from '@polivalko/shared/api/problem'
import { apiFetch } from '@/shared/api/client'
import { csrfHeader, forgetCsrf } from '@/shared/api/csrf'

export type UploadResult<T> = { data?: T; problem?: Problem; response: Response }

export async function postForm<T>(url: string, data: FormData): Promise<UploadResult<T>> {
  const send = async () => apiFetch(url, { method: 'POST', body: data, headers: await csrfHeader() })
  let response = await send()
  if (response.status === 400) {
    const problem = (await response.clone().json().catch(() => null)) as Problem | null
    if (problem?.code === 'auth.csrf_invalid') {
      forgetCsrf()
      response = await send()
    }
  }
  if (response.ok) return { data: (await response.json()) as T, response }
  return { problem: ((await response.json().catch(() => null)) as Problem | null) ?? undefined, response }
}
