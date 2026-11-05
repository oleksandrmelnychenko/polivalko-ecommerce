import { Link } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import type { PermissionKey } from '@/shared/auth/permissionKeys'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { CellStack } from '@/shared/ui/Money'
import type { AuditEntry } from '../api/auditApi'
import type { PermissionName } from '../lib/auditDetails'
import { actionLabel, entityHref, entityTypeLabel } from '../lib/auditLabels'
import { AuditDetailsSummary } from './AuditDetailsSummary'

type AuditColumnsContext = {
  can: (permission: PermissionKey) => boolean
  permissionName: PermissionName
}

export function auditColumns({ can, permissionName }: AuditColumnsContext): DataTableColumn<AuditEntry>[] {
  return [
    {
      id: 'at',
      header: 'Коли',
      width: 170,
      cell: (row) => <span className="audit-nowrap">{formatDateTime(row.at)}</span>,
    },
    {
      id: 'actor',
      header: 'Хто',
      width: 200,
      cell: (row) => <CellStack title={row.actor} />,
    },
    {
      id: 'action',
      header: 'Дія',
      width: 290,
      cell: (row) => <CellStack title={actionLabel[row.action] ?? row.action} sub={actionLabel[row.action] ? row.action : undefined} />,
    },
    {
      id: 'entity',
      header: "Об'єкт",
      width: 210,
      cell: (row) => {
        const href = entityHref(row.entityType, row.entityId, can)
        return (
          <CellStack
            title={entityTypeLabel[row.entityType] ?? row.entityType}
            sub={row.entityId ? href ? <Link to={href}>{row.entityId}</Link> : row.entityId : undefined}
          />
        )
      },
    },
    {
      id: 'details',
      header: 'Деталі',
      fill: true,
      width: 320,
      cell: (row) => <AuditDetailsSummary entry={row} permissionName={permissionName} />,
    },
  ]
}
