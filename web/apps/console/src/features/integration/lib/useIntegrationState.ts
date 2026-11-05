import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export const INTEGRATION_TABS = ['jobs', 'runs', 'outbox', 'novaposhta'] as const

export type IntegrationTab = (typeof INTEGRATION_TABS)[number]

export function useIntegrationState(canManageOutbox: boolean) {
  const [params, setParams] = useSearchParams()
  const job = params.get('job') ?? ''

  const tab = useMemo<IntegrationTab>(() => {
    const raw = params.get('tab') as IntegrationTab | null
    const fallback: IntegrationTab = job ? 'runs' : 'jobs'
    if (!raw || !INTEGRATION_TABS.includes(raw)) return fallback
    if (raw === 'outbox' && !canManageOutbox) return fallback
    return raw
  }, [params, job, canManageOutbox])

  const setTab = useCallback(
    (next: IntegrationTab) => {
      setParams(
        (current) => {
          const search = new URLSearchParams(current)
          if (next === 'jobs' && !search.get('job')) search.delete('tab')
          else search.set('tab', next)
          return search
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const setJob = useCallback(
    (next: string | null) => {
      setParams(
        (current) => {
          const search = new URLSearchParams(current)
          if (next) search.set('job', next)
          else search.delete('job')
          search.set('tab', 'runs')
          return search
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return { tab, job, setTab, setJob }
}
