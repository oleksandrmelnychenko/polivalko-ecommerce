import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { CellStack } from '@/shared/ui/Money'
import type { SyncJob } from '../api/integrationApi'
import { when } from '../lib/labels'
import type { ShowDetail } from './DetailModal'
import { ErrorText, Failures } from './ErrorText'
import { RunCell, type RunRequest } from './RunCell'

type JobsColumnsContext = {
  requests: Record<string, RunRequest>
  canRun: boolean
  canImport: boolean
  onRun: (job: string) => void
  onExpand: ShowDetail
}

export function jobsColumns({ requests, canRun, canImport, onRun, onExpand }: JobsColumnsContext): DataTableColumn<SyncJob>[] {
  return [
    {
      id: 'job',
      header: 'Завдання',
      accessor: (row) => row.title,
      fill: true,
      width: 240,
      cell: (row) => <CellStack title={row.title} sub={row.job} />,
    },
    {
      id: 'lastAttemptAt',
      header: 'Остання спроба',
      accessor: (row) => row.lastAttemptAt,
      sortDescFirst: true,
      width: 170,
      cell: (row) => when(row.lastAttemptAt),
    },
    {
      id: 'lastSuccessAt',
      header: 'Останній успіх',
      accessor: (row) => row.lastSuccessAt,
      sortDescFirst: true,
      width: 170,
      cell: (row) => when(row.lastSuccessAt),
    },
    {
      id: 'consecutiveFailures',
      header: 'Збоїв поспіль',
      accessor: (row) => row.consecutiveFailures,
      sortDescFirst: true,
      align: 'right',
      numeric: true,
      width: 130,
      cell: (row) => <Failures count={row.consecutiveFailures} />,
    },
    {
      id: 'lastError',
      header: 'Остання помилка',
      width: 260,
      cell: (row) => <ErrorText text={row.lastError} title={`${row.title}: остання помилка`} onExpand={onExpand} />,
    },
    {
      id: 'run',
      header: 'Запуск',
      width: 230,
      cell: (row) => <RunCell job={row} request={requests[row.job]} canRun={canRun} canImport={canImport} onRun={() => onRun(row.job)} />,
    },
  ]
}
