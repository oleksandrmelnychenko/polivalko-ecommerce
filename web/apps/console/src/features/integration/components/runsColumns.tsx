import { plural } from '@polivalko/shared/lib/format'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { TableChip } from '@/shared/ui/TableChip'
import type { SyncRun } from '../api/integrationApi'
import { runStatusLabel, runStatusTone, when } from '../lib/labels'
import type { ShowDetail } from './DetailModal'
import { RunErrors } from './RunErrors'

type RunsColumnsContext = {
  titles: ReadonlyMap<string, string>
  onExpand: ShowDetail
}

export function errorsLabel(count: number): string {
  return `${count} ${plural(count, 'помилка', 'помилки', 'помилок')}`
}

export function runsColumns({ titles, onExpand }: RunsColumnsContext): DataTableColumn<SyncRun>[] {
  return [
    {
      id: 'job',
      header: 'Завдання',
      accessor: (row) => titles.get(row.job) ?? row.job,
      width: 220,
      cell: (row) => titles.get(row.job) ?? <span className="integration-code">{row.job}</span>,
    },
    {
      id: 'startedAt',
      header: 'Почато',
      accessor: (row) => row.startedAt,
      sortDescFirst: true,
      width: 170,
      cell: (row) => when(row.startedAt),
    },
    {
      id: 'finishedAt',
      header: 'Завершено',
      accessor: (row) => row.finishedAt,
      sortDescFirst: true,
      width: 170,
      cell: (row) => (row.finishedAt ? when(row.finishedAt) : <span className="integration-muted">ще триває</span>),
    },
    {
      id: 'status',
      header: 'Результат',
      accessor: (row) => runStatusLabel[row.status],
      width: 200,
      cell: (row) => <TableChip dot tone={runStatusTone[row.status]} value={runStatusLabel[row.status] ?? row.status} />,
    },
    {
      id: 'startedBy',
      header: 'Хто запустив',
      accessor: (row) => row.startedBy,
      width: 180,
    },
    {
      id: 'summary',
      header: 'Підсумок',
      fill: true,
      width: 260,
      cell: (row) =>
        row.summary ? (
          <span className="integration-clamp" title={row.summary}>
            {row.summary}
          </span>
        ) : (
          <span className="integration-muted">немає</span>
        ),
    },
    {
      id: 'errors',
      header: 'Помилки',
      accessor: (row) => row.errorCount,
      sortDescFirst: true,
      width: 140,
      cell: (row) =>
        row.errorCount === 0 ? (
          <span className="integration-muted">немає</span>
        ) : (
          <button
            type="button"
            className="integration-error-more"
            aria-haspopup="dialog"
            onClick={() =>
              onExpand({
                title: `${titles.get(row.job) ?? row.job}, ${when(row.startedAt)}: ${errorsLabel(row.errorCount)}`,
                body: <RunErrors run={row} />,
              })
            }
          >
            {errorsLabel(row.errorCount)}
          </button>
        ),
    },
  ]
}
