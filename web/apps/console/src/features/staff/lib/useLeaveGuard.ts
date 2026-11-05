import { useEffect, useEffectEvent } from 'react'

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function useLeaveGuard(active: boolean, onLeaveAttempt: (to: string) => void): void {
  const attempt = useEffectEvent(onLeaveAttempt)

  useEffect(() => {
    if (!active) return undefined

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      const to = `${url.pathname}${url.search}${url.hash}`
      if (to === currentPath()) return
      event.preventDefault()
      event.stopPropagation()
      attempt(to)
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [active])
}
