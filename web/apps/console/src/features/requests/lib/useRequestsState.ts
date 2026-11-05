import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_PAGE_SIZE, normalizePageSize } from '@/shared/ui/paginator/pageSize'
import { REQUEST_STATUSES, type RequestStatus } from '../api/requestsApi'

type RequestsParam = 'status' | 'page' | 'pageSize'

export type RequestsState = { status: RequestStatus | ''; page: number; pageSize: number }
export type RequestsPatch = Partial<Record<RequestsParam, string | number | null>>

const DEFAULTS: Partial<Record<RequestsParam, string>> = { page: '1', pageSize: String(DEFAULT_PAGE_SIZE) }

export function isRequestStatus(value: string | null | undefined): value is RequestStatus {
  return Boolean(value) && REQUEST_STATUSES.includes(value as RequestStatus)
}

function readRequestsState(params: URLSearchParams): RequestsState {
  const status = params.get('status')
  return {
    status: isRequestStatus(status) ? status : '',
    page: Math.max(Number(params.get('page')) || 1, 1),
    pageSize: normalizePageSize(params.get('pageSize') ?? DEFAULT_PAGE_SIZE),
  }
}

export function useRequestsState() {
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => readRequestsState(params), [params])

  const update = useCallback(
    (patch: RequestsPatch) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, raw] of Object.entries(patch) as [RequestsParam, string | number | null][]) {
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

  return { state, update }
}
