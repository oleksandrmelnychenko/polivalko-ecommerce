import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_PAGE_SIZE, normalizePageSize } from '@/shared/ui/paginator/pageSize'
import { REFUND_STATUSES, type RefundRowStatus, type RefundsQuery } from '../api/returnsApi'

export type ReturnsParam = 'q' | 'status' | 'from' | 'to' | 'page' | 'pageSize'

export type ReturnsState = {
  q: string
  status: RefundRowStatus | ''
  from: string
  to: string
  page: number
  pageSize: number
}

export type ReturnsPatch = Partial<Record<ReturnsParam, string | number | null>>

const DEFAULTS: Partial<Record<ReturnsParam, string>> = { page: '1', pageSize: String(DEFAULT_PAGE_SIZE) }
const DATE = /^\d{4}-\d{2}-\d{2}$/

function readDate(value: string | null): string {
  return value && DATE.test(value) ? value : ''
}

export function readReturnsState(params: URLSearchParams): ReturnsState {
  const status = params.get('status') as RefundRowStatus | null
  return {
    q: params.get('q') ?? '',
    status: status && REFUND_STATUSES.includes(status) ? status : '',
    from: readDate(params.get('from')),
    to: readDate(params.get('to')),
    page: Math.max(Number(params.get('page')) || 1, 1),
    pageSize: normalizePageSize(params.get('pageSize') ?? DEFAULT_PAGE_SIZE),
  }
}

export function toRefundsQuery(state: ReturnsState): RefundsQuery {
  return {
    q: state.q.trim() || undefined,
    status: state.status || undefined,
    from: state.from || undefined,
    to: state.to || undefined,
    page: state.page,
    pageSize: state.pageSize,
  }
}

export function hasActiveFilters(state: ReturnsState): boolean {
  return Boolean(state.q.trim() || state.status || state.from || state.to)
}

export function useReturnsState() {
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => readReturnsState(params), [params])

  const update = useCallback(
    (patch: ReturnsPatch) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, raw] of Object.entries(patch) as [ReturnsParam, string | number | null][]) {
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

  return { state, update, reset }
}
