import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import type { Problem } from '@polivalko/shared/api/problem'

export type ApiResult<T> = { data?: T; error?: unknown; response: Response }

export type ApiQueryStatus = 'loading' | 'ready' | 'error' | 'forbidden'

type Settled<T> = {
  key: string | null
  status: Exclude<ApiQueryStatus, 'loading'>
  data?: T
  problem?: Problem
}

export type ApiQuery<T> = {
  status: ApiQueryStatus
  data: T | undefined
  problem: Problem | undefined
  isLoading: boolean
  isFetching: boolean
  reload: () => void
  setData: (data: T) => void
}

export function useApiQuery<T>(key: string, load: () => Promise<ApiResult<T>>, options: { enabled?: boolean } = {}): ApiQuery<T> {
  const enabled = options.enabled ?? true
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState<Settled<T>>({ key: null, status: 'ready' })
  const current = `${key}#${nonce}`
  const fetchData = useEffectEvent(load)

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    fetchData()
      .then(({ data, error, response }) => {
        if (cancelled) return
        if (response.ok) {
          setState({ key: current, status: 'ready', data })
          return
        }
        setState((previous) => ({
          key: current,
          status: response.status === 403 ? 'forbidden' : 'error',
          data: previous.data,
          problem: error as Problem | undefined,
        }))
      })
      .catch(() => {
        if (!cancelled) setState((previous) => ({ key: current, status: 'error', data: previous.data }))
      })
    return () => {
      cancelled = true
    }
  }, [current, enabled])

  const settled = state.key === current
  const status: ApiQueryStatus = settled ? state.status : state.data !== undefined ? 'ready' : 'loading'
  const reload = useCallback(() => setNonce((value) => value + 1), [])
  const setData = useCallback((data: T) => setState((previous) => ({ ...previous, status: 'ready', data })), [])

  return {
    status,
    data: state.data,
    problem: settled ? state.problem : undefined,
    isLoading: status === 'loading',
    isFetching: enabled && !settled,
    reload,
    setData,
  }
}
