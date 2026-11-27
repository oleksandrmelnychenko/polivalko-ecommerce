import { useEffect, useEffectEvent, useState } from 'react'

export type ActivityStreamMode = 'live' | 'polling' | 'paused'

const STREAM_URL = '/api/v1/console/orders/activity/stream'

/**
 * Subscribes to real-time SSE shop activity notifications with automatic fallback polling.
 * Pauses cleanly when the browser tab is hidden or the staff member clicks Pause.
 */
export function useActivityStream(paused: boolean, onUpdate: () => void): ActivityStreamMode {
  const [sseConnected, setSseConnected] = useState(false)
  const trigger = useEffectEvent(() => {
    if (document.visibilityState === 'visible') onUpdate()
  })

  useEffect(() => {
    if (paused) return undefined

    let source: EventSource | null = null
    if (typeof EventSource !== 'undefined') {
      source = new EventSource(STREAM_URL, { withCredentials: true })
      source.onopen = () => setSseConnected(true)
      source.onerror = () => setSseConnected(false)
      source.addEventListener('activity', () => trigger())
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') trigger()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      source?.close()
      setSseConnected(false)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [paused])

  useEffect(() => {
    if (paused) return undefined
    // Fast 5s polling when SSE is unavailable; gentle 20s reconciliation when SSE is connected.
    const intervalMs = sseConnected ? 20_000 : 5_000
    const timer = window.setInterval(trigger, intervalMs)
    return () => window.clearInterval(timer)
  }, [paused, sseConnected])

  if (paused) return 'paused'
  return sseConnected ? 'live' : 'polling'
}
