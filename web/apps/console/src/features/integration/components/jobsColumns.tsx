import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { TableChip } from '@/shared/ui/TableChip'
import type { SyncJob } from '../api/integrationApi'
import { shortWhen } from '@/shared/lib/when'
import { jobState } from '../lib/labels'
import { JobIcon } from './JobIcon'

export function jobsColumns(): DataTableColumn<SyncJob>[] {
  return [
    {
      id: 'job',
      header: 'Завдання',
      accessor: (row) => row.title,
      enableSorting: false,
      fill: true,
      width: 260,
      minWidth: 200,
      cell: (row) => (
        <span className="app-split-name-cell">
          <span className="app-split-kind-icon">
            <JobIcon job={row.job} size={16} />
          </span>
          <span className="app-split-item-name">{row.title}</span>
        </span>
      ),
    },
    {
      id: 'state',
      header: 'Стан',
      accessor: (row) => jobState(row).label,
      enableSorting: false,
      width: 180,
      cell: (row) => {
        const state = jobState(row)
        return <TableChip dot tone={state.tone} value={state.label} />
      },
    },
    {
      id: 'lastSuccessAt',
      header: 'Останній успіх',
      accessor: (row) => row.lastSuccessAt,
      enableSorting: false,
      width: 170,
      cell: (row) => <span className={row.lastSuccessAt ? 'app-split-item-meta' : 'app-split-item-meta is-off'}>{shortWhen(row.lastSuccessAt)}</span>,
    },
  ]
}
