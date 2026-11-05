import { Link } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { CellStack, NumberValue } from '@/shared/ui/Money'
import type { AccountRow } from '../api/accountsApi'
import { accountHref } from '../lib/accountsState'
import { initials } from '../lib/initials'
import { AccountChips } from './AccountChips'

export const accountsColumns: DataTableColumn<AccountRow>[] = [
  {
    id: 'account',
    header: 'Покупець',
    width: 280,
    fill: true,
    cell: (row) => (
      <span className="customers-person">
        <span className="customers-avatar" aria-hidden="true">
          {initials(row.name || row.email)}
        </span>
        <CellStack title={<Link to={accountHref(row.id)}>{row.name || 'Без імені'}</Link>} sub={row.email} />
      </span>
    ),
  },
  {
    id: 'phone',
    header: 'Телефон',
    width: 150,
    cell: (row) =>
      row.phone ? (
        <a className="customers-phone" href={`tel:${row.phone}`}>
          {row.phone}
        </a>
      ) : (
        '—'
      ),
  },
  {
    id: 'state',
    header: 'Стан',
    width: 290,
    cell: (row) => <AccountChips emailConfirmed={row.emailConfirmed} lockedOut={row.lockedOut} />,
  },
  {
    id: 'ordersCount',
    header: 'Замовлень',
    align: 'right',
    numeric: true,
    width: 120,
    cell: (row) => <NumberValue value={row.ordersCount} />,
  },
  {
    id: 'createdAt',
    header: 'Зареєстровано',
    width: 170,
    cell: (row) => <span className="app-number">{formatDateTime(row.createdAt)}</span>,
  },
]
