import { shortWhen } from '@/shared/lib/when'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { SplitAvatar } from '@/shared/ui/split/SplitAvatar'
import { RequestStatusChip } from '@/shared/ui/StatusChip'
import type { ServiceRequest } from '../api/requestsApi'

export function requestsColumns(open: (request: ServiceRequest) => void, compact: boolean): DataTableColumn<ServiceRequest>[] {
  const columns: DataTableColumn<ServiceRequest>[] = [
    {
      id: 'client', header: 'Клієнт', fill: true, width: compact ? 160 : 280, minWidth: 145,
      cell: (row) => (
        <button className="request-client" type="button" aria-haspopup="dialog" onClick={() => open(row)}>
          <SplitAvatar name={row.name} size="sm" muted={row.status === 'done'} />
          <span>
            <b>{row.name}</b>
            <small className="request-number">{row.phone}</small>
            {compact && <small>{row.directionName}</small>}
          </span>
        </button>
      ),
    },
    { id: 'direction', header: 'Напрямок', width: 220, cell: (row) => row.directionName },
    { id: 'status', header: 'Статус', width: compact ? 110 : 145, cell: (row) => (
      <div className="request-row-status">
        <RequestStatusChip status={row.status} />
        {compact && <small className="request-number">{shortWhen(row.createdAt)}</small>}
      </div>
    ) },
    { id: 'created', header: 'Отримано', width: 160, cell: (row) => <span className="request-number">{shortWhen(row.createdAt)}</span> },
  ]
  return compact ? columns.filter(({ id }) => id === 'client' || id === 'status') : columns
}
