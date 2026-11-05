import { Button } from '@mantine/core'
import { IconRotateClockwise } from '@tabler/icons-react'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { CellStack } from '@/shared/ui/Money'
import { TableChip } from '@/shared/ui/TableChip'
import type { OutboxMessage } from '../api/integrationApi'
import { messageTypeLabel, when } from '../lib/labels'
import type { ShowDetail } from './DetailModal'
import { ErrorText } from './ErrorText'

type OutboxColumnsContext = {
  busy: string | null
  onRetry: (message: OutboxMessage) => void
  onExpand: ShowDetail
}

export function outboxColumns({ busy, onRetry, onExpand }: OutboxColumnsContext): DataTableColumn<OutboxMessage>[] {
  return [
    {
      id: 'type',
      header: 'Операція',
      accessor: (row) => messageTypeLabel[row.type] ?? row.type,
      fill: true,
      width: 260,
      cell: (row) => <CellStack title={messageTypeLabel[row.type] ?? row.type} sub={row.type} />,
    },
    {
      id: 'occurredAt',
      header: 'Виникла',
      accessor: (row) => row.occurredAt,
      sortDescFirst: true,
      width: 170,
      cell: (row) => when(row.occurredAt),
    },
    {
      id: 'status',
      header: 'Стан',
      accessor: (row) => row.status,
      width: 190,
      cell: (row) =>
        row.status === 'failed' ? <TableChip dot tone="danger" value="Не виконано" /> : <TableChip dot tone="warning" value="Повтор за розкладом" />,
    },
    {
      id: 'attempts',
      header: 'Спроб',
      accessor: (row) => row.attempts,
      sortDescFirst: true,
      align: 'right',
      numeric: true,
      width: 90,
    },
    {
      id: 'nextAttemptAt',
      header: 'Наступна спроба',
      width: 180,
      cell: (row) => (row.status === 'failed' ? <span className="integration-muted">спроби вичерпано</span> : when(row.nextAttemptAt)),
    },
    {
      id: 'lastError',
      header: 'Остання помилка',
      width: 260,
      cell: (row) => <ErrorText text={row.lastError} title={`${messageTypeLabel[row.type] ?? row.type}: остання помилка`} onExpand={onExpand} />,
    },
    {
      id: 'action',
      header: <span className="visually-hidden">Дія</span>,
      width: 150,
      cell: (row) => (
        <Button
          size="xs"
          variant="default"
          leftSection={<IconRotateClockwise size={14} stroke={1.8} />}
          disabled={busy !== null && busy !== row.id}
          loading={busy === row.id}
          onClick={() => onRetry(row)}
        >
          Повторити
        </Button>
      ),
    },
  ]
}
