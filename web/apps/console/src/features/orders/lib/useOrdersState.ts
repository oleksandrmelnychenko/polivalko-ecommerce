import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_PAGE_SIZE } from '@/shared/ui/paginator/pageSize'
import { readOrdersState, type ParamKey } from './orderFilters'

export type OrdersPatch = Partial<Record<ParamKey, string | number | null>>

const DEFAULTS: Partial<Record<ParamKey, string>> = { sort: 'newest', page: '1', pageSize: String(DEFAULT_PAGE_SIZE) }

export function useOrdersState() {
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => readOrdersState(params), [params])

  const update = useCallback(
    (patch: OrdersPatch) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, raw] of Object.entries(patch) as [ParamKey, string | number | null][]) {
            const value = raw == null ? '' : String(raw).trim()
            if (!value || DEFAULTS[key] === value) next.delete(key)
            else next.set(key, value)
          }
          if (!('page' in patch)) next.delete('page')
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
        const next = new URLSearchParams()
        for (const key of ['status', 'sort', 'pageSize'] as const) {
          const value = current.get(key)
          if (value) next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }, [setParams])

  return { state, params, update, reset }
}
