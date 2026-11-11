import { Button } from '@mantine/core'
import { IconAlertTriangle, IconCircleCheck, IconClockHour4, IconFileImport, IconPlayerPlay } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import type { ApiQuery } from '@/shared/api/useApiQuery'
import { TableChip } from '@/shared/ui/TableChip'
import type { NovaPoshtaStatus, SyncJob } from '../api/integrationApi'
import { moment } from '@/shared/lib/when'
import { FILE_IMPORT_JOB, jobDescription, jobState, NOVA_POSHTA_JOB, waitsForWorker, when } from '../lib/labels'
import type { ShowDetail } from './DetailModal'
import { JobIcon } from './JobIcon'
import { JobRunsCard } from './JobRunsCard'
import { NovaPoshtaCard } from './NovaPoshtaCard'

export type RunRequest = { busy?: boolean; accepted?: boolean; error?: string }

type JobDetailPaneProps = {
  job: SyncJob | null
  request?: RunRequest
  canRun: boolean
  canImport: boolean
  np: ApiQuery<NovaPoshtaStatus>
  refreshKey: number
  onRun: (job: string) => void
  onExpand: ShowDetail
  onOpenRuns: (job: string) => void
}

const ERROR_PREVIEW = 320

function Moment({ iso }: { iso: string | null }) {
  if (!iso) return <span className="integration-stat-none">ще не було</span>
  const { day, time } = moment(iso)
  return (
    <>
      {time}
      <small>{day}</small>
    </>
  )
}

function JobAction({ job, request, canRun, canImport, onRun }: Pick<JobDetailPaneProps, 'request' | 'canRun' | 'canImport' | 'onRun'> & { job: SyncJob }) {
  if (job.job === FILE_IMPORT_JOB)
    return canImport ? (
      <Button component={Link} to="/catalog/import" leftSection={<IconFileImport size={16} stroke={1.7} />}>
        Завантажити файл
      </Button>
    ) : null
  if (!canRun || request?.accepted || waitsForWorker(job)) return null
  return (
    <Button leftSection={<IconPlayerPlay size={16} stroke={1.7} />} loading={request?.busy} onClick={() => onRun(job.job)}>
      Запустити зараз
    </Button>
  )
}

function RunNote({ job, request, canRun }: { job: SyncJob; request?: RunRequest; canRun: boolean }) {
  if (request?.error)
    return (
      <p className="integration-hero-note is-bad" role="alert">
        <IconAlertTriangle size={16} stroke={1.8} aria-hidden="true" />
        {request.error}
      </p>
    )
  if (request?.accepted)
    return (
      <p className="integration-hero-note is-good" role="status">
        <IconCircleCheck size={16} stroke={1.8} aria-hidden="true" />
        Запит прийнято. Фонова служба запустить завдання протягом хвилини, результат з&apos;явиться в запусках нижче.
      </p>
    )
  if (waitsForWorker(job))
    return (
      <p className="integration-hero-note" role="status">
        <IconClockHour4 size={16} stroke={1.8} aria-hidden="true" />
        Запит від {when(job.runRequestedAt)} чекає на фонову службу.
      </p>
    )
  if (!canRun && job.job !== FILE_IMPORT_JOB) return <p className="integration-hero-note">Завдання запускається за розкладом. Запуск вручну вам недоступний.</p>
  return null
}

export function JobDetailPane(props: JobDetailPaneProps) {
  const { job, request, canRun, np, refreshKey, onExpand, onOpenRuns } = props
  if (!job) return <section className="app-split-detail app-split-detail-empty">Оберіть завдання зліва.</section>

  const state = jobState(job)
  const error = job.lastError
  const longError = Boolean(error && error.length > ERROR_PREVIEW)

  return (
    <section key={job.job} className="app-split-detail" aria-labelledby="integration-job-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <span className={`integration-job-icon is-${state.tone}`} aria-hidden="true">
              <JobIcon job={job.job} size={28} />
            </span>
            <div className="app-split-hero-main">
              <p className="app-split-hero-kicker app-split-mono">{job.job}</p>
              <h2 id="integration-job-title">
                {job.title}
                <TableChip dot tone={state.tone} value={state.label} />
              </h2>
              {jobDescription[job.job] ? <p className="app-split-description">{jobDescription[job.job]}</p> : null}
            </div>
          </div>
          <div className="app-split-actions">
            <JobAction job={job} request={request} canRun={canRun} canImport={props.canImport} onRun={props.onRun} />
          </div>
        </div>

        <RunNote job={job} request={request} canRun={canRun} />

        <dl className="app-split-stats integration-stats">
          <div>
            <dt>Остання спроба</dt>
            <dd>
              <Moment iso={job.lastAttemptAt} />
            </dd>
          </div>
          <div>
            <dt>Останній успіх</dt>
            <dd>
              <Moment iso={job.lastSuccessAt} />
            </dd>
          </div>
          <div>
            <dt>Збоїв поспіль</dt>
            <dd className={job.consecutiveFailures ? 'integration-stat-bad' : undefined}>{job.consecutiveFailures}</dd>
          </div>
        </dl>
      </header>

      {error ? (
        <section className="integration-error-card" aria-labelledby="integration-job-error">
          <h3 id="integration-job-error">
            <IconAlertTriangle size={16} stroke={1.8} aria-hidden="true" />
            Остання помилка
          </h3>
          <p>{longError ? `${error.slice(0, ERROR_PREVIEW).trimEnd()}…` : error}</p>
          {longError ? (
            <button
              type="button"
              className="integration-error-more"
              aria-haspopup="dialog"
              onClick={() => onExpand({ title: `${job.title}: остання помилка`, body: <pre className="integration-pre">{error}</pre> })}
            >
              Показати повністю
            </button>
          ) : null}
        </section>
      ) : null}

      {job.job === NOVA_POSHTA_JOB ? <NovaPoshtaCard np={np} /> : null}

      <JobRunsCard job={job} refreshKey={refreshKey} onExpand={onExpand} onOpenRuns={onOpenRuns} />
    </section>
  )
}
