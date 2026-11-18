import { useEffect, useEffectEvent } from 'react'

export function useReportDirty(dirty: boolean, onDirty: ((dirty: boolean) => void) | undefined): void {
  const report = useEffectEvent((value: boolean) => onDirty?.(value))

  useEffect(() => {
    report(dirty)
  }, [dirty])

  useEffect(() => () => report(false), [])
}
