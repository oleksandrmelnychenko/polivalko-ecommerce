import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PARAM_DEFAULTS, readCustomersState, type CustomersParam } from './customersState'

export type CustomersPatch = Partial<Record<CustomersParam, string | number | null>>

export function useCustomersState() {
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => readCustomersState(params), [params])

  const update = useCallback(
    (patch: CustomersPatch) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, raw] of Object.entries(patch) as [CustomersParam, string | number | null][]) {
            const value = raw == null ? '' : String(raw).trim()
            if (!value || PARAM_DEFAULTS[key] === value) next.delete(key)
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

  return { state, update }
}
