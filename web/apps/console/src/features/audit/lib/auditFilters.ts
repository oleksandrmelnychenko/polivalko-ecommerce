import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_PAGE_SIZE, normalizePageSize } from '@/shared/ui/paginator/pageSize'
import type { AuditQuery } from '../api/auditApi'

export type AuditState = { q: string; entityType: string; page: number; pageSize: number }

type ParamKey = keyof AuditState

export type AuditPatch = Partial<Record<ParamKey, string | number | null>>

const DEFAULTS: Partial<Record<ParamKey, string>> = { page: '1', pageSize: String(DEFAULT_PAGE_SIZE) }

export function readAuditState(params: URLSearchParams): AuditState {
  return {
    q: params.get('q') ?? '',
    entityType: params.get('entityType') ?? '',
    page: Math.max(Number(params.get('page')) || 1, 1),
    pageSize: normalizePageSize(params.get('pageSize') ?? DEFAULT_PAGE_SIZE),
  }
}

export function toAuditQuery(state: AuditState): AuditQuery {
  return {
    entityType: state.entityType || undefined,
    q: state.q || undefined,
    page: state.page,
    pageSize: state.pageSize,
  }
}

export function useAuditState() {
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => readAuditState(params), [params])

  const update = useCallback(
    (patch: AuditPatch) => {
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

  return { state, update, reset }
}
