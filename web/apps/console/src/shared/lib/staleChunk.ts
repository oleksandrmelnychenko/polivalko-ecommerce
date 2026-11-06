const reloadKey = 'pv-console:chunk-reload-at'
const reloadPause = 30_000

export function reloadOnStaleChunk(error: unknown): boolean {
  if (!(error instanceof Error) || error.name !== 'ChunkLoadError') return false
  const last = Number(sessionStorage.getItem(reloadKey) || 0)
  if (Date.now() - last < reloadPause) return false
  sessionStorage.setItem(reloadKey, String(Date.now()))
  window.location.reload()
  return true
}
