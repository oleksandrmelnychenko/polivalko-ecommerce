import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { CellStack } from '@/shared/ui/Money'
import { TableChip } from '@/shared/ui/TableChip'
import type { PickupPoint } from '../api/settingsApi'

export const pickupColumns: DataTableColumn<PickupPoint>[] = [
  {
    id: 'name',
    header: 'Точка',
    accessor: (row) => row.name,
    width: 220,
    cell: (row) => <CellStack title={row.name} sub={row.code} />,
  },
  {
    id: 'address',
    header: 'Адреса',
    accessor: (row) => row.address,
    fill: true,
    width: 220,
    cell: (row) => <span className="settings-clamp">{row.address}</span>,
  },
  {
    id: 'schedule',
    header: 'Графік роботи',
    width: 180,
    cell: (row) => <span className="settings-clamp">{row.schedule}</span>,
  },
  {
    id: 'mapUrl',
    header: 'Посилання на карту',
    width: 170,
    cell: (row) =>
      row.mapUrl ? (
        <a href={row.mapUrl} target="_blank" rel="noopener noreferrer" className="settings-ellipsis">
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
    width: 130,
    cell: (row) => (row.isActive ? <TableChip dot tone="success" value="Доступна" /> : <TableChip dot tone="neutral" value="Вимкнена" />),
  },
]
