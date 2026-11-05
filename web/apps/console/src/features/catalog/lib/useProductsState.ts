import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_PAGE_SIZE } from '@/shared/ui/paginator/pageSize'
import { readProductsState, type ParamKey } from './productFilters'

export type ProductsPatch = Partial<Record<ParamKey, string | number | null>>

const DEFAULTS: Partial<Record<ParamKey, string>> = { page: '1', pageSize: String(DEFAULT_PAGE_SIZE) }

export function useProductsState() {
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => readProductsState(params), [params])

  const update = useCallback(
    (patch: ProductsPatch) => {
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
        const pageSize = current.get('pageSize')
        if (pageSize) next.set('pageSize', pageSize)
        return next
      },
      { replace: true },
    )
  }, [setParams])

  return { state, params, update, reset }
}
