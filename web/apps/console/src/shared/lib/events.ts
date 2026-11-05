export type ConsoleEvent = 'unauthorized' | 'permissions-changed' | 'summary-stale' | 'open-search'

const eventName = (event: ConsoleEvent) => `pv-console:${event}`

export function emitConsoleEvent(event: ConsoleEvent): void {
  window.dispatchEvent(new CustomEvent(eventName(event)))
}

export function onConsoleEvent(event: ConsoleEvent, handler: () => void): () => void {
  const listener = () => handler()
  window.addEventListener(eventName(event), listener)
  return () => window.removeEventListener(eventName(event), listener)
}

export const notifySummaryStale = () => emitConsoleEvent('summary-stale')
export const notifyPermissionsChanged = () => emitConsoleEvent('permissions-changed')
export const openSearchPalette = () => emitConsoleEvent('open-search')
