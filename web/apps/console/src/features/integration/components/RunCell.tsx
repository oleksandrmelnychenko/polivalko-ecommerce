import { Button } from '@mantine/core'
import { IconPlayerPlay } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import type { SyncJob } from '../api/integrationApi'
import { FILE_IMPORT_JOB, waitsForWorker, when } from '../lib/labels'

export type RunRequest = { busy?: boolean; accepted?: boolean; error?: string }

type RunCellProps = {
  job: SyncJob
  request?: RunRequest
  canRun: boolean
  canImport: boolean
  onRun: () => void
}

export function RunCell({ job, request, canRun, canImport, onRun }: RunCellProps) {
  if (job.job === FILE_IMPORT_JOB)
    return canImport ? (
      <Link to="/catalog/import" className="integration-link">
        Завантажити файл
      </Link>
    ) : (
      <span className="integration-muted">—</span>
    )
  if (request?.accepted)
    return (
      <span role="status" className="integration-note">
        Запит прийнято, Worker виконає протягом хвилини.
      </span>
    )
  if (waitsForWorker(job)) return <span className="integration-muted integration-note">Запит від {when(job.runRequestedAt)} чекає Worker.</span>
  if (!canRun) return <span className="integration-muted">за розкладом</span>
  return (
    <span className="integration-run">
      <Button size="xs" variant="default" leftSection={<IconPlayerPlay size={14} stroke={1.8} />} loading={request?.busy} onClick={onRun}>
        Запустити зараз
      </Button>
      {request?.error ? (
        <span className="integration-bad integration-note" role="alert">
          {request.error}
        </span>
      ) : null}
    </span>
  )
}
