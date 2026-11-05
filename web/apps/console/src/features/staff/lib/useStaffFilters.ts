import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { StaffUser } from '../api/staffApi'

export type StaffAccessFilter = '' | 'active' | 'locked'
export type StaffFilters = { q: string; role: string; access: StaffAccessFilter }
type StaffFilterKey = keyof StaffFilters

const KEYS: readonly StaffFilterKey[] = ['q', 'role', 'access']

function readFilters(params: URLSearchParams): StaffFilters {
  const access = params.get('access')
  return {
    q: params.get('q') ?? '',
    role: params.get('role') ?? '',
    access: access === 'active' || access === 'locked' ? access : '',
  }
}

export function useStaffFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readFilters(params), [params])

  const update = useCallback(
    (patch: Partial<Record<StaffFilterKey, string | null>>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, raw] of Object.entries(patch)) {
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
        for (const key of KEYS) next.delete(key)
        return next
      },
      { replace: true },
    )
  }, [setParams])

  const filtered = Boolean(filters.q || filters.role || filters.access)
  return { filters, filtered, update, reset }
}

export function filterStaff(users: readonly StaffUser[], filters: StaffFilters): StaffUser[] {
  const query = filters.q.trim().toLocaleLowerCase('uk')
  return users
    .filter((user) => !filters.role || user.roleId === filters.role)
    .filter((user) => !filters.access || (filters.access === 'locked' ? user.lockedOut : !user.lockedOut))
    .filter((user) => !query || `${user.displayName} ${user.email}`.toLocaleLowerCase('uk').includes(query))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'uk', { sensitivity: 'base' }))
}
