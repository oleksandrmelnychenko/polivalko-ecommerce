import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import type { PermissionKey } from '@/shared/auth/permissionKeys'
import { AppDrawer } from '@/shared/ui/AppDrawer'
import type { AuditEntry } from '../api/auditApi'
import { readRoleChange, type PermissionName, type RoleChange } from '../lib/auditDetails'
import { actionLabel, entityHref, entityTypeLabel } from '../lib/auditLabels'

type AuditEntryDrawerProps = {
  entry: AuditEntry | null
  opened: boolean
  onClose: () => void
  can: (permission: PermissionKey) => boolean
  permissionName: PermissionName
}

export function AuditEntryDrawer({ entry, opened, onClose, can, permissionName }: AuditEntryDrawerProps) {
  return (
    <AppDrawer opened={opened} onClose={onClose} title={entry ? (actionLabel[entry.action] ?? entry.action) : 'Журнал змін'} size="compact">
      {entry ? <AuditEntryBody entry={entry} can={can} permissionName={permissionName} /> : null}
    </AppDrawer>
  )
}

function AuditEntryBody({ entry, can, permissionName }: { entry: AuditEntry; can: (permission: PermissionKey) => boolean; permissionName: PermissionName }) {
  const href = entityHref(entry.entityType, entry.entityId, can)
  const role = readRoleChange(entry.action, entry.details)

  return (
    <div className="audit-entry">
      <dl className="audit-dl">
        <Row label="Коли">{formatDateTime(entry.at)}</Row>
        <Row label="Хто">{entry.actor}</Row>
        <Row label="Дія">
          {actionLabel[entry.action] ?? entry.action}
          {actionLabel[entry.action] ? <span className="audit-code audit-block">{entry.action}</span> : null}
        </Row>
        <Row label="Об'єкт">
          {entityTypeLabel[entry.entityType] ?? entry.entityType}
          {entry.entityId ? (
            href ? (
              <Link to={href} className="audit-code audit-block">
                {entry.entityId}
              </Link>
            ) : (
              <span className="audit-code audit-block">{entry.entityId}</span>
            )
          ) : null}
        </Row>
      </dl>

      {role ? <RoleChangeView change={role} permissionName={permissionName} /> : null}

      <section className="audit-section" aria-labelledby="audit-json-title">
        <h3 id="audit-json-title" className="app-section-title">
          Деталі
        </h3>
        {entry.details == null ? <p className="audit-muted">немає</p> : <pre className="audit-pre">{JSON.stringify(entry.details, null, 2)}</pre>}
      </section>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="audit-dl-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function RoleChangeView({ change, permissionName }: { change: RoleChange; permissionName: PermissionName }) {
  return (
    <section className="audit-section" aria-labelledby="audit-role-title">
      <h3 id="audit-role-title" className="app-section-title">
        Роль
      </h3>
      <dl className="audit-dl">
        {change.kind === 'updated' ? (
          <>
            <Row label="Назва">
              {change.before.name !== change.after.name ? (
                <>
                  <span className="audit-was">{change.before.name ?? '—'}</span> → {change.after.name ?? '—'}
                </>
              ) : (
                (change.after.name ?? '—')
              )}
            </Row>
            <Row label="Опис">
              {change.before.description !== change.after.description ? (
                <>
                  <span className="audit-was">{change.before.description ?? '—'}</span> → {change.after.description ?? '—'}
                </>
              ) : (
                (change.after.description ?? '—')
              )}
            </Row>
          </>
        ) : (
          <>
            <Row label="Назва">{change.role.name ?? '—'}</Row>
            {change.kind === 'created' ? <Row label="Опис">{change.role.description ?? '—'}</Row> : null}
          </>
        )}
        {change.kind === 'created' ? (
          <Row label="Права">
            <PermissionList keys={change.permissions} permissionName={permissionName} />
          </Row>
        ) : null}
        {change.kind === 'permissions' ? (
          <>
            <Row label="Додано">
              <PermissionList keys={change.added} permissionName={permissionName} tone="added" />
            </Row>
            <Row label="Вилучено">
              <PermissionList keys={change.removed} permissionName={permissionName} tone="removed" />
            </Row>
          </>
        ) : null}
      </dl>
    </section>
  )
}

function PermissionList({ keys, permissionName, tone }: { keys: string[]; permissionName: PermissionName; tone?: 'added' | 'removed' }) {
  if (keys.length === 0) return <span className="audit-muted">немає</span>
  return (
    <ul className={`audit-permissions${tone ? ` is-${tone}` : ''}`}>
      {keys.map((key) => (
        <li key={key}>
          <span>{permissionName(key)}</span>
          <span className="audit-code">{key}</span>
        </li>
      ))}
    </ul>
  )
}
