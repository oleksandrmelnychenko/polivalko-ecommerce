import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export function useElementClientWidth(element: HTMLElement | null): number {
  const [width, setWidth] = useState(0)
  const widthRef = useRef(0)
  const commitWidth = useCallback((nextWidth: number) => {
    const normalized = Number.isFinite(nextWidth) ? Math.max(0, Math.round(nextWidth)) : 0
    if (widthRef.current === normalized) return
    widthRef.current = normalized
    setWidth(normalized)
  }, [])

  useLayoutEffect(() => {
    if (!element) return undefined
    const observer = new ResizeObserver(() => commitWidth(element.clientWidth))
    observer.observe(element)
    commitWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [commitWidth, element])

  return element ? width : 0
}
