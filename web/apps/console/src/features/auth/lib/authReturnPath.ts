const RETURN_PATH_KEY = 'pv-console:return-path'

export type ReturnLocation = { pathname: string; search?: string; hash?: string }

export function toPath(location: ReturnLocation): string {
  return `${location.pathname}${location.search ?? ''}${location.hash ?? ''}`
}

export function rememberReturnPath(location: ReturnLocation): void {
  const path = sanitizeReturnPath(toPath(location))
  if (!path) return
  try {
    window.sessionStorage.setItem(RETURN_PATH_KEY, path)
  } catch {
    return
  }
}

export function consumeReturnPath(fallback = '/'): string {
  try {
    const path = sanitizeReturnPath(window.sessionStorage.getItem(RETURN_PATH_KEY))
    window.sessionStorage.removeItem(RETURN_PATH_KEY)
    return path ?? fallback
  } catch {
    return fallback
  }
}

export function sanitizeReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin || url.pathname === '/login') return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}
