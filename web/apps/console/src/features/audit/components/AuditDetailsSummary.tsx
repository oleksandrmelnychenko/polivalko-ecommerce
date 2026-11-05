import type { AuditEntry } from '../api/auditApi'
import { genericSummary, readRoleChange, roleChangeSummary, type PermissionName } from '../lib/auditDetails'

export function AuditDetailsSummary({ entry, permissionName }: { entry: AuditEntry; permissionName: PermissionName }) {
  if (entry.details == null) return <span className="audit-muted">немає</span>
  const role = readRoleChange(entry.action, entry.details)
  const summary = role ? roleChangeSummary(role, permissionName) : genericSummary(entry.details)
  return (
    <span className="audit-clamp" title={summary}>
      {summary}
    </span>
  )
}
