import { AuditEntityIcon } from '@/shared/audit/AuditEntityIcon'
import type { AuditEntry } from '@/shared/audit/auditApi'
import { actionText, entityText } from '@/shared/audit/auditLabels'
import { shortWhen } from '@/shared/lib/when'
import type { DataTableColumn } from '@/shared/ui/data-table/types'

export const AUDIT_COLUMNS: DataTableColumn<AuditEntry>[] = [
  {
    id: 'action',
    header: 'Подія',
    fill: true,
    width: 340,
    minWidth: 240,
    cell: (row) => (
      <span className="app-split-name-cell">
        <span className="app-split-kind-icon">
          <AuditEntityIcon entityType={row.entityType} size={16} />
        </span>
        <span className="audit-event">
          <span className="app-split-item-name">{actionText(row.action)}</span>
          <span className="audit-event-object">
            {entityText(row.entityType)}
            {row.entityId ? <span className="audit-event-id"> {row.entityId}</span> : null}
          </span>
        </span>
      </span>
    ),
  },
  {
    id: 'actor',
    header: 'Хто',
    width: 180,
    cell: (row) => <span className="app-split-item-meta audit-ellipsis">{row.actor}</span>,
  },
  {
    id: 'at',
    header: 'Коли',
    width: 160,
    cell: (row) => <span className="app-split-item-meta">{shortWhen(row.at)}</span>,
  },
]
