import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import type { Problem } from '@polivalko/shared/api/problem'

export type ApiResult<T> = { data?: T; error?: unknown; response: Response }

export type ApiQueryStatus = 'loading' | 'ready' | 'error' | 'forbidden'

type Settled<T> = {
  attempt: string | null
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

export type ApiQueryOptions = { enabled?: boolean; keepPrevious?: boolean }

export function useApiQuery<T>(key: string, load: () => Promise<ApiResult<T>>, options: ApiQueryOptions = {}): ApiQuery<T> {
  const enabled = options.enabled ?? true
  const keepPrevious = options.keepPrevious ?? false
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState<Settled<T>>({ attempt: null, key: null, status: 'ready' })
  const current = `${key}#${nonce}`
  const fetchData = useEffectEvent(load)

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    fetchData()
      .then(({ data, error, response }) => {
        if (cancelled) return
        if (response.ok) {
          setState({ attempt: current, key, status: 'ready', data })
          return
        }
        setState((previous) => ({
          attempt: current,
          key,
          status: response.status === 403 ? 'forbidden' : 'error',
          data: previous.key === key ? previous.data : undefined,
          problem: error as Problem | undefined,
        }))
      })
      .catch(() => {
        if (!cancelled) setState((previous) => ({ attempt: current, key, status: 'error', data: previous.key === key ? previous.data : undefined }))
      })
    return () => {
      cancelled = true
    }
  }, [current, enabled, key])

  const settled = state.attempt === current
  const placeholder = keepPrevious && enabled && !settled
  const data = state.key === key || placeholder ? state.data : undefined
  const status: ApiQueryStatus = settled ? state.status : data !== undefined ? 'ready' : 'loading'
  const reload = useCallback(() => setNonce((value) => value + 1), [])
  const setData = useCallback((next: T) => setState((previous) => (previous.key === key ? { ...previous, status: 'ready', data: next } : previous)), [key])

  return {
    status,
    data,
    problem: settled ? state.problem : undefined,
    isLoading: status === 'loading',
    isFetching: enabled && !settled,
    reload,
    setData,
  }
}
