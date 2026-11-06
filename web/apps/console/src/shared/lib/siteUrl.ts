const base = (process.env.SITE_URL || 'http://localhost:8080').replace(/\/+$/, '')

export function siteUrl(path = '/'): string {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
