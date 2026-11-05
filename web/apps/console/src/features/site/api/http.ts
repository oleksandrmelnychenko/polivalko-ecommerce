import type { Problem } from '@polivalko/shared/api/problem'
import { apiFetch } from '@/shared/api/client'
import { csrfHeader, forgetCsrf } from '@/shared/api/csrf'

export type UploadResult<T> = { data?: T; error?: Problem; response: Response }

export async function postFile<T>(url: string, file: File): Promise<UploadResult<T>> {
  const send = async () => {
    const data = new FormData()
    data.set('file', file)
    return apiFetch(url, { method: 'POST', body: data, headers: await csrfHeader() })
  }
  let response = await send()
  if (response.status === 400) {
    const problem = (await readJson(response.clone())) as Problem | undefined
    if (problem?.code === 'auth.csrf_invalid') {
      forgetCsrf()
      response = await send()
    }
  }
  const payload = await readJson(response)
  return response.ok ? { data: payload as T, response } : { error: payload as Problem | undefined, response }
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const text = await response.text().catch(() => '')
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
