import { Select } from '@mantine/core'
import { IconPhone } from '@tabler/icons-react'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { serviceRequestStatusLabel } from '@polivalko/shared/lib/labels'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { RequestStatusChip } from '@/shared/ui/StatusChip'
import { TableChip } from '@/shared/ui/TableChip'
import { REQUEST_STATUSES, type RequestStatus, type ServiceRequest } from '../api/requestsApi'
import { isRequestStatus } from '../lib/useRequestsState'

const STATUS_OPTIONS = REQUEST_STATUSES.map((value) => ({ value, label: serviceRequestStatusLabel[value] ?? value }))

type StatusControl = {
  canChange: boolean
  pending: ReadonlyMap<string, RequestStatus>
  onChange: (row: ServiceRequest, status: RequestStatus) => void
}

export function requestsColumns({ canChange, pending, onChange }: StatusControl): DataTableColumn<ServiceRequest>[] {
  return [
    {
      id: 'client',
      header: 'Клієнт',
      width: 220,
      cell: (row) => (
        <span className="app-cell-stack">
          <span className="app-cell-title">{row.name}</span>
          <a className="requests-phone" href={`tel:${row.phone}`}>
            <IconPhone size={12} stroke={1.8} aria-hidden="true" />
            {row.phone}
          </a>
        </span>
      ),
    },
    {
      id: 'direction',
      header: 'Напрямок',
      width: 200,
      cell: (row) => <TableChip value={row.directionName} />,
    },
    {
      id: 'comment',
      header: 'Коментар',
      width: 320,
      fill: true,
      cell: (row) =>
        row.comment ? (
          <span className="requests-comment" title={row.comment}>
            {row.comment}
          </span>
        ) : (
          <span className="requests-muted">без коментаря</span>
        ),
    },
    {
      id: 'createdAt',
      header: 'Отримано',
      width: 150,
      cell: (row) => <span className="app-number">{formatDateTime(row.createdAt)}</span>,
    },
    {
      id: 'status',
      header: 'Статус',
      width: canChange ? 190 : 150,
      cell: (row) => {
        if (!canChange) return <RequestStatusChip status={row.status} />
        const target = pending.get(row.id)
        return (
          <Select
            className="requests-status-select"
            aria-label="Статус заявки"
            data={STATUS_OPTIONS}
            value={target ?? row.status}
            allowDeselect={false}
            disabled={target !== undefined}
            size="xs"
            w={160}
            data-row-click-ignore
            onChange={(value) => {
              if (isRequestStatus(value) && value !== row.status) onChange(row, value)
            }}
          />
        )
      },
    },
  ]
}
