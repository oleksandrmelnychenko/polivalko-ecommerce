import { useEffect, useEffectEvent } from 'react'

export function useSalesRefresh(refresh: () => void) {
  const update = useEffectEvent(() => {
    if (document.visibilityState === 'visible') refresh()
  })
  useEffect(() => {
    const timer = window.setInterval(update, 30_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
}
