import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { CellStack } from '@/shared/ui/Money'
import { TableChip } from '@/shared/ui/TableChip'
import type { PickupPoint } from '../api/settingsApi'

export const pickupColumns: DataTableColumn<PickupPoint>[] = [
  {
    id: 'name',
    header: 'Точка',
    accessor: (row) => row.name,
    width: 170,
    cell: (row) => <CellStack title={row.name} sub={row.code} />,
  },
  {
    id: 'address',
    header: 'Адреса',
    accessor: (row) => row.address,
    fill: true,
    width: 160,
    minWidth: 140,
    cell: (row) => <span className="settings-clamp">{row.address}</span>,
  },
  {
    id: 'schedule',
    header: 'Графік роботи',
    width: 150,
    cell: (row) => <span className="settings-clamp">{row.schedule}</span>,
  },
  {
    id: 'mapUrl',
    header: 'Карта',
    width: 120,
    cell: (row) =>
      row.mapUrl ? (
        <a href={row.mapUrl} target="_blank" rel="noopener noreferrer" className="settings-ellipsis" data-row-click-ignore>
          {row.mapUrl.replace(/^https?:\/\//, '')}
        </a>
      ) : (
        <span className="settings-muted">немає</span>
      ),
  },
  {
    id: 'isActive',
    header: 'Стан',
    accessor: (row) => row.isActive,
    width: 110,
    cell: (row) => (row.isActive ? <TableChip dot tone="success" value="Доступна" /> : <TableChip dot tone="neutral" value="Вимкнена" />),
  },
]
