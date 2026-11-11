import { Skeleton } from '@mantine/core'
import { IconArrowRight } from '@tabler/icons-react'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { TableChip } from '@/shared/ui/TableChip'
import { getRuns, type SyncJob } from '../api/integrationApi'
import { shortWhen } from '@/shared/lib/when'
import { duration, runStatusLabel, runStatusTone } from '../lib/labels'
import type { ShowDetail } from './DetailModal'
import { ListError } from './ListError'
import { RunErrors } from './RunErrors'
import { errorsLabel } from './runsColumns'

const VISIBLE = 8

type JobRunsCardProps = {
  job: SyncJob
  refreshKey: number
  onExpand: ShowDetail
  onOpenRuns: (job: string) => void
}

export function JobRunsCard({ job, refreshKey, onExpand, onOpenRuns }: JobRunsCardProps) {
  const runs = useApiQuery(`integration-job-runs:${job.job}:${refreshKey}`, () => getRuns(job.job))
  const items = runs.data ?? []
  const failed = runs.status === 'error' || runs.status === 'forbidden'

  return (
    <section className="app-split-card" aria-labelledby="integration-job-runs">
      <header className="app-split-card-head">
        <h3 id="integration-job-runs">Останні запуски</h3>
        {items.length > VISIBLE ? (
          <button type="button" className="integration-card-link" onClick={() => onOpenRuns(job.job)}>
            Усі {items.length} в журналі
            <IconArrowRight size={14} stroke={2} aria-hidden="true" />
          </button>
        ) : null}
      </header>
      {runs.isLoading ? (
        <div className="integration-runs-skeleton">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} height={44} radius={8} />
          ))}
        </div>
      ) : failed && !items.length ? (
        <ListError problem={runs.problem} onRetry={runs.reload} />
      ) : !items.length ? (
        <p className="app-split-blank">Завдання ще не запускалося.</p>
      ) : (
        <ol className="integration-runs" data-fetching={runs.isFetching || undefined}>
          {items.slice(0, VISIBLE).map((run) => {
            const took = duration(run.startedAt, run.finishedAt)
            return (
              <li key={run.id} className={`integration-run is-${runStatusTone[run.status]}`}>
                <span className="integration-run-dot" aria-hidden="true" />
                <div className="integration-run-body">
                  <p className="integration-run-line">
                    <strong>{shortWhen(run.startedAt)}</strong>
                    <TableChip tone={runStatusTone[run.status]} value={runStatusLabel[run.status] ?? run.status} />
                    <span>{took ?? 'ще триває'}</span>
                    <span>{run.startedBy}</span>
                  </p>
                  {run.summary ? <p className="integration-run-summary">{run.summary}</p> : null}
                  {run.errorCount > 0 ? (
                    <button
                      type="button"
                      className="integration-error-more"
                      aria-haspopup="dialog"
                      onClick={() => onExpand({ title: `${job.title}, ${shortWhen(run.startedAt)}: ${errorsLabel(run.errorCount)}`, body: <RunErrors run={run} /> })}
                    >
                      {errorsLabel(run.errorCount)}
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
