import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_PAGE_SIZE, normalizePageSize } from '@/shared/ui/paginator/pageSize'
import type { AccountStatusFilter, AccountsQuery } from '../api/accountsApi'

export type AccountsParam = 'q' | 'status' | 'page' | 'pageSize'

export type AccountsState = {
  q: string
  status: AccountStatusFilter
  page: number
  pageSize: number
}

export type AccountsPatch = Partial<Record<AccountsParam, string | number | null>>

export const accountStatusLabel: Record<AccountStatusFilter, string> = {
  all: 'Усі',
  confirmed: 'Пошта підтверджена',
  unconfirmed: 'Пошта не підтверджена',
  locked: 'Заблоковані',
}

export const ACCOUNT_STATUS_OPTIONS = (Object.keys(accountStatusLabel) as AccountStatusFilter[]).map((value) => ({ value, label: accountStatusLabel[value] }))

const DEFAULTS: Partial<Record<AccountsParam, string>> = { status: 'all', page: '1', pageSize: String(DEFAULT_PAGE_SIZE) }

export function isAccountStatus(value: string | null | undefined): value is AccountStatusFilter {
  return typeof value === 'string' && Object.hasOwn(accountStatusLabel, value)
}

export function readAccountsState(params: URLSearchParams): AccountsState {
  const status = params.get('status')
  return {
    q: params.get('q') ?? '',
    status: isAccountStatus(status) ? status : 'all',
    page: Math.max(Number(params.get('page')) || 1, 1),
    pageSize: normalizePageSize(params.get('pageSize') ?? DEFAULT_PAGE_SIZE),
  }
}

export function toAccountsQuery(state: AccountsState): AccountsQuery {
  return {
    q: state.q.trim() || undefined,
    status: state.status === 'all' ? undefined : state.status,
    page: state.page,
    pageSize: state.pageSize,
  }
}

export function accountHref(id: string): string {
  return `/sales/customers/accounts/${encodeURIComponent(id)}`
}

export const ACCOUNTS_LIST_PATH = '/sales/customers?tab=accounts'

export function useAccountsState() {
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => readAccountsState(params), [params])

  const update = useCallback(
    (patch: AccountsPatch) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, raw] of Object.entries(patch) as [AccountsParam, string | number | null][]) {
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
