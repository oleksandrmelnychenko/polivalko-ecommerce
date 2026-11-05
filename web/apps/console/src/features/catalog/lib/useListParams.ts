import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useListParams<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()

  const values = useMemo(() => Object.fromEntries(keys.map((key) => [key, params.get(key)?.trim() ?? ''])) as Record<K, string>, [keys, params])

  const set = useCallback(
    (patch: Partial<Record<K, string | null>>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, raw] of Object.entries(patch) as [K, string | null][]) {
            const value = raw?.trim() ?? ''
            if (value) next.set(key, value)
            else next.delete(key)
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const reset = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const key of keys) next.delete(key)
        return next
      },
      { replace: true },
    )
  }, [keys, setParams])

  return { values, set, reset }
}
