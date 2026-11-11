import { Button, Select } from '@mantine/core'
import { IconFileImport, IconRefresh } from '@tabler/icons-react'
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Can, usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { notifySummaryStale } from '@/shared/lib/events'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { FilterBar } from '@/shared/ui/FilterBar'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { ScreenTabs, type ScreenTab } from '@/shared/ui/ScreenTabs'
import { getIntegrationStatus, getNovaPoshta, getOutbox, getRuns, retryOutbox, runJob, type OutboxMessage, type SyncJob, type SyncRun } from '../api/integrationApi'
import { useDetailModal } from '../components/DetailModal'
import { IntegrationSummary } from '../components/IntegrationSummary'
import { JobDetailPane, type RunRequest } from '../components/JobDetailPane'
import { jobsColumns } from '../components/jobsColumns'
import { ListError } from '../components/ListError'
import { outboxColumns } from '../components/outboxColumns'
import { runsColumns } from '../components/runsColumns'
import { messageTypeLabel } from '../lib/labels'
import { useIntegrationState, type IntegrationTab } from '../lib/useIntegrationState'
import '@/shared/ui/split/split.css'
import './integration.css'

const jobRowId = (row: SyncJob) => row.job
const runRowId = (row: SyncRun) => row.id
const outboxRowId = (row: OutboxMessage) => row.id

const JOB_COLUMNS = jobsColumns()

const NO_CONNECTION = "Немає зв'язку з сервером."

export function IntegrationPage() {
  const { can } = usePermissions()
  const canRun = can(PermissionKeys.Integration.RunJobs)
  const canManageOutbox = can(PermissionKeys.Integration.ManageOutbox)
  const canImport = can(PermissionKeys.Catalog.RunImport)
  const { tab, job, setTab, selectJob, setJob } = useIntegrationState(canManageOutbox)
  const detail = useDetailModal()

  const status = useApiQuery('integration-status', () => getIntegrationStatus())
  const runs = useApiQuery(`integration-runs:${job}`, () => getRuns(job || undefined), { enabled: tab === 'runs' })
  const outbox = useApiQuery('integration-outbox', () => getOutbox(), { enabled: canManageOutbox })
  const np = useApiQuery('integration-novaposhta', () => getNovaPoshta())
  const reloadStatus = status.reload
  const reloadOutbox = outbox.reload

  const [requests, setRequests] = useState<Record<string, RunRequest>>({})
  const [retrying, setRetrying] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const jobs = useMemo(() => status.data?.jobs ?? [], [status.data])
  const titles = useMemo(() => new Map(jobs.map((item) => [item.job, item.title])), [jobs])
  const selected = jobs.find((item) => item.job === job) ?? jobs[0] ?? null
  const selectedId = selected?.job ?? null
  const rowClassName = useCallback((row: SyncJob) => (row.job === selectedId ? 'app-split-row-active' : undefined), [selectedId])
  const pickJob = useCallback((row: SyncJob) => selectJob(row.job), [selectJob])

  const run = useCallback(
    async (name: string) => {
      setRequests((current) => ({ ...current, [name]: { busy: true } }))
      let next: RunRequest
      try {
        const result = await withCsrf((headers) => runJob(headers, name))
        next = result.response.ok ? { accepted: true } : { error: problemMessage(result.error, 'Завдання не запущено.') }
        if (result.response.ok) reloadStatus()
      } catch {
        next = { error: NO_CONNECTION }
      }
      setRequests((current) => ({ ...current, [name]: next }))
    },
    [reloadStatus],
  )

  const retry = useCallback(
    async (message: OutboxMessage) => {
      setRetrying(message.id)
      const label = messageTypeLabel[message.type] ?? message.type
      try {
        const result = await withCsrf((headers) => retryOutbox(headers, message.id))
        if (result.response.ok) {
          notifySuccess(`«${label}» знову в черзі. Фонова служба виконає операцію протягом хвилини.`)
          reloadOutbox()
          reloadStatus()
          notifySummaryStale()
        } else {
          notifyError(problemMessage(result.error, 'Операцію не повторено.'))
        }
      } catch {
        notifyError(NO_CONNECTION)
      }
      setRetrying(null)
    },
    [reloadOutbox, reloadStatus],
  )

  const runColumns = useMemo(() => runsColumns({ titles, onExpand: detail.show }), [titles, detail.show])
  const messageColumns = useMemo(() => outboxColumns({ busy: retrying, onRetry: (message) => void retry(message), onExpand: detail.show }), [retrying, retry, detail.show])
  const openOutbox = useCallback(() => setTab('outbox'), [setTab])

  function refresh() {
    status.reload()
    if (tab === 'jobs') {
      setRequests({})
      setRefreshKey((value) => value + 1)
      np.reload()
    } else if (tab === 'runs') runs.reload()
    else outbox.reload()
  }

  const refreshing = status.isFetching || (tab === 'runs' ? runs.isFetching : tab === 'outbox' ? outbox.isFetching : np.isFetching)

  const failedOutbox = (outbox.data ?? []).some((message) => message.status === 'failed')
  const tabs: ScreenTab<IntegrationTab>[] = [
    { value: 'jobs', label: 'Фонові завдання', count: status.data ? jobs.length : null, hot: jobs.some((item) => item.consecutiveFailures > 0) },
    { value: 'runs', label: 'Журнал запусків' },
    ...(canManageOutbox ? [{ value: 'outbox' as const, label: 'Черга операцій', count: outbox.data ? outbox.data.length : null, hot: failedOutbox }] : []),
  ]

  const jobOptions = useMemo(() => {
    const options = jobs.map((item) => ({ value: item.job, label: item.title }))
    if (job && !titles.has(job)) options.push({ value: job, label: job })
    return options
  }, [jobs, job, titles])

  const statusFailed = status.status === 'error' || status.status === 'forbidden'
  const runsFailed = runs.status === 'error' || runs.status === 'forbidden'
  const outboxFailed = outbox.status === 'error' || outbox.status === 'forbidden'

  return (
    <ListPage>
      <PageHeader
        title="Інтеграції"
        actions={
          <>
            <Button variant="default" leftSection={<IconRefresh size={16} stroke={1.8} />} loading={refreshing} onClick={refresh}>
              Оновити
            </Button>
            <Can permission={PermissionKeys.Catalog.RunImport}>
              <Button component={Link} to="/catalog/import" variant="default" leftSection={<IconFileImport size={16} stroke={1.8} />}>
                Імпорт каталогу з файлу
              </Button>
            </Can>
          </>
        }
      />

      {status.data ? <IntegrationSummary status={status.data} onOpenJob={selectJob} onOpenOutbox={canManageOutbox ? openOutbox : undefined} /> : null}

      <ScreenTabs tabs={tabs} value={tab} label="Розділи інтеграцій" onChange={setTab} />

      {tab === 'runs' ? (
        <FilterBar
          label="Фільтр запусків"
          search={
            <Select
              className="integration-job-filter"
              label="Завдання"
              placeholder="Усі"
              data={jobOptions}
              value={job || null}
              clearable
              onChange={(value) => setJob(value)}
            />
          }
        />
      ) : null}

      <ListPageBody>
        {tab === 'jobs' ? (
          <div className="app-split-layout">
            <div className="app-split-list">
              <DataTable
                ariaLabel="Фонові завдання"
                columns={JOB_COLUMNS}
                data={statusFailed ? [] : jobs}
                getRowId={jobRowId}
                isLoading={status.isLoading}
                isFetching={status.isFetching}
                minWidth={560}
                height="100%"
                onRowClick={pickJob}
                rowClassName={rowClassName}
                emptyText={statusFailed ? <ListError problem={status.problem} onRetry={status.reload} /> : 'Завдань немає.'}
              />
            </div>
            <JobDetailPane
              job={selected}
              request={selected ? requests[selected.job] : undefined}
              canRun={canRun}
              canImport={canImport}
              np={np}
              refreshKey={refreshKey}
              onRun={(name) => void run(name)}
              onExpand={detail.show}
              onOpenRuns={setJob}
            />
          </div>
        ) : null}
        {tab === 'runs' ? (
          <DataTable
            ariaLabel="Журнал запусків"
            columns={runColumns}
            data={runsFailed ? [] : (runs.data ?? [])}
            getRowId={runRowId}
            isLoading={runs.isLoading}
            isFetching={runs.isFetching}
            minWidth={1280}
            height="100%"
            emptyText={
              runsFailed ? (
                <ListError problem={runs.problem} onRetry={runs.reload} />
              ) : job ? (
                'Це завдання ще не запускалося.'
              ) : (
                'Запусків ще не було.'
              )
            }
          />
        ) : null}
        {tab === 'outbox' && canManageOutbox ? (
          <DataTable
            ariaLabel="Черга операцій"
            columns={messageColumns}
            data={outboxFailed ? [] : (outbox.data ?? [])}
            getRowId={outboxRowId}
            isLoading={outbox.isLoading}
            isFetching={outbox.isFetching}
            minWidth={1240}
            height="100%"
            emptyText={
              outboxFailed ? (
                <ListError problem={outbox.problem} onRetry={outbox.reload} />
              ) : (
                'Невдалих і відкладених операцій немає.'
              )
            }
          />
        ) : null}
      </ListPageBody>

      {detail.modal}
    </ListPage>
  )
}
