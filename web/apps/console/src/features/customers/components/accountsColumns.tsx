import { shortWhen } from '@/shared/lib/when'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { NumberValue } from '@/shared/ui/Money'
import { SplitAvatar } from '@/shared/ui/split/SplitAvatar'
import { TableChip } from '@/shared/ui/TableChip'
import type { AccountRow } from '../api/accountsApi'

function AccountState({ row }: { row: AccountRow }) {
  if (row.lockedOut) return <TableChip dot tone="danger" value="Вхід заблоковано" />
  return row.emailConfirmed ? <TableChip dot tone="success" value="Пошта підтверджена" /> : <TableChip dot tone="warning" value="Пошта не підтверджена" />
}

export const ACCOUNTS_COLUMNS: DataTableColumn<AccountRow>[] = [
  {
    id: 'account',
    header: 'Покупець',
    fill: true,
    width: 260,
    minWidth: 200,
    cell: (row) => (
      <span className="app-split-name-cell">
        <SplitAvatar name={row.name || row.email} size="sm" muted={row.lockedOut} />
        <span className="app-split-row-text">
          <span className="app-split-item-name">{row.name || 'Без імені'}</span>
          <span className="app-split-row-sub">{row.email}</span>
        </span>
      </span>
    ),
  },
  {
    id: 'state',
    header: 'Стан',
    width: 190,
    cell: (row) => <AccountState row={row} />,
  },
  {
    id: 'ordersCount',
    header: 'Замовлень',
    align: 'right',
    numeric: true,
    width: 110,
    cell: (row) => <NumberValue value={row.ordersCount} />,
  },
  {
    id: 'createdAt',
    header: 'Зареєстровано',
    width: 150,
    cell: (row) => <span className="app-split-item-meta">{shortWhen(row.createdAt)}</span>,
  },
]
