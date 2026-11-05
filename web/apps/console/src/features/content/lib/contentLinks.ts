export const CONTENT_PAGES_PATH = '/site/pages'

export function pageEditorHref(slug: string): string {
  return `${CONTENT_PAGES_PATH}/${encodeURIComponent(slug)}`
}
