import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { NOVA_POSHTA_JOB } from './labels'

export const INTEGRATION_TABS = ['jobs', 'runs', 'outbox'] as const

export type IntegrationTab = (typeof INTEGRATION_TABS)[number]

export function useIntegrationState(canManageOutbox: boolean) {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const job = params.get('job') ?? (raw === 'novaposhta' ? NOVA_POSHTA_JOB : '')

  const tab = useMemo<IntegrationTab>(() => {
    if (!raw || !INTEGRATION_TABS.includes(raw as IntegrationTab)) return 'jobs'
    if (raw === 'outbox' && !canManageOutbox) return 'jobs'
    return raw as IntegrationTab
  }, [raw, canManageOutbox])

  const update = useCallback(
    (next: { tab?: IntegrationTab; job?: string | null }) => {
      setParams(
        (current) => {
          const search = new URLSearchParams(current)
          if (next.tab) {
            if (next.tab === 'jobs') search.delete('tab')
            else search.set('tab', next.tab)
          }
          if (next.job !== undefined) {
            if (next.job) search.set('job', next.job)
            else search.delete('job')
          }
          return search
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const setTab = useCallback((next: IntegrationTab) => update({ tab: next }), [update])
  const selectJob = useCallback((next: string) => update({ tab: 'jobs', job: next }), [update])
  const setJob = useCallback((next: string | null) => update({ tab: 'runs', job: next }), [update])

  return { tab, job, setTab, selectJob, setJob }
}
