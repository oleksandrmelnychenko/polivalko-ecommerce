import { shortWhen } from '@/shared/lib/when'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { SplitAvatar } from '@/shared/ui/split/SplitAvatar'
import { RequestStatusChip } from '@/shared/ui/StatusChip'
import type { ServiceRequest } from '../api/requestsApi'

export const REQUESTS_COLUMNS: DataTableColumn<ServiceRequest>[] = [
  {
    id: 'client',
    header: 'Клієнт',
    fill: true,
    width: 260,
    minWidth: 200,
    cell: (row) => (
      <span className="app-split-name-cell">
        <SplitAvatar name={row.name} size="sm" muted={row.status === 'done'} />
        <span className="app-split-row-text">
          <span className="app-split-item-name">{row.name}</span>
          <span className="app-split-row-sub">{row.phone}</span>
        </span>
      </span>
    ),
  },
  {
    id: 'direction',
    header: 'Напрямок',
    width: 180,
    cell: (row) => <span className="app-split-item-meta">{row.directionName}</span>,
  },
  {
    id: 'status',
    header: 'Статус',
    width: 130,
    cell: (row) => <RequestStatusChip status={row.status} />,
  },
  {
    id: 'createdAt',
    header: 'Отримано',
    width: 160,
    cell: (row) => <span className="app-split-item-meta">{shortWhen(row.createdAt)}</span>,
  },
]
