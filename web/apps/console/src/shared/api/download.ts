import { apiFetch } from './client'

export async function downloadFile(url: string, fallbackName: string): Promise<boolean> {
  const response = await apiFetch(url)
  if (!response.ok) return false
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(response.headers.get('content-disposition') ?? '')?.[1]
  const href = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = name ? decodeURIComponent(name) : fallbackName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(href)
  return true
}
