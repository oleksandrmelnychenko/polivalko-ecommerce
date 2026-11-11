import { Button, Skeleton } from '@mantine/core'
import { IconArrowRight } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime, plural } from '@polivalko/shared/lib/format'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { getAudit, type AuditEntry } from '@/shared/audit/auditApi'
import { AuditEntityIcon } from '@/shared/audit/AuditEntityIcon'
import { actionText, actionTone, entityHref, entityText } from '@/shared/audit/auditLabels'
import { AuditTimeline } from '@/shared/audit/AuditTimeline'
import type { PermissionKey } from '@/shared/auth/permissionKeys'
import { moment } from '@/shared/lib/when'
import { readChanges, type AuditValue } from '../lib/auditChanges'
import { readRoleChange, type PermissionName, type RoleChange } from '../lib/auditDetails'

type AuditEntryPaneProps = {
  entry: AuditEntry | null
  can: (permission: PermissionKey) => boolean
  permissionName: PermissionName
  onShowObject: (entry: AuditEntry) => void
}

export function AuditEntryPane({ entry, can, permissionName, onShowObject }: AuditEntryPaneProps) {
  if (!entry) return <section className="app-split-detail app-split-detail-empty">Оберіть подію зліва.</section>

  const href = entityHref(entry.entityType, entry.entityId, can)
  const role = readRoleChange(entry.action, entry.details)
  const changes = role ? null : readChanges(entry)
  const time = moment(entry.at)
  const object = entityText(entry.entityType)

  return (
    <section key={entry.id} className="app-split-detail" aria-labelledby="audit-entry-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <span className={`audit-entity-icon is-${actionTone(entry.action)}`} aria-hidden="true">
              <AuditEntityIcon entityType={entry.entityType} size={28} />
            </span>
            <div className="app-split-hero-main">
              <p className="app-split-hero-kicker">{object}</p>
              <h2 id="audit-entry-title">{actionText(entry.action)}</h2>
              <p className="app-split-hero-aliases app-split-mono">{entry.action}</p>
            </div>
          </div>
          {href ? (
            <div className="app-split-actions">
              <Button component={Link} to={href} variant="default" rightSection={<IconArrowRight size={16} stroke={1.7} />}>
                Відкрити
              </Button>
            </div>
          ) : null}
        </div>

        <dl className="app-split-stats audit-stats">
          <div>
            <dt>Хто</dt>
            <dd>{entry.actor}</dd>
          </div>
          <div>
            <dt>Коли</dt>
            <dd title={formatDateTime(entry.at)}>
              <span className="app-split-mono audit-stat-time">{time.time}</span>
              <small>{time.day}</small>
            </dd>
          </div>
          <div>
            <dt>{object}</dt>
            <dd>{entry.entityId ? href ? <Link to={href}>{entry.entityId}</Link> : <span className="audit-stat-id">{entry.entityId}</span> : <span className="audit-stat-none">без коду</span>}</dd>
          </div>
        </dl>
      </header>

      {role ? <RoleChangeCard change={role} permissionName={permissionName} /> : null}

      {changes && (changes.diff.length > 0 || changes.fields.length > 0 || changes.unchanged > 0) ? (
        <section className="app-split-card" aria-labelledby="audit-changes-title">
          <header className="app-split-card-head">
            <h3 id="audit-changes-title">{changes.diff.length || changes.unchanged ? 'Що змінилось' : 'Подробиці'}</h3>
            {changes.diff.length && changes.unchanged ? (
              <span>
                ще {changes.unchanged} {plural(changes.unchanged, 'поле', 'поля', 'полів')} без змін
              </span>
            ) : null}
          </header>
          {!changes.diff.length && !changes.fields.length ? (
            <p className="app-split-blank">Збережено без змін: усі {changes.unchanged} {plural(changes.unchanged, 'поле', 'поля', 'полів')} мають ті самі значення.</p>
          ) : null}
          {changes.diff.length ? (
            <div className="audit-diff" role="table" aria-label="Зміни">
              <div className="audit-diff-head" role="row">
                <span role="columnheader">Поле</span>
                <span role="columnheader">Було</span>
                <span role="columnheader">Стало</span>
              </div>
              {changes.diff.map((row) => (
                <div key={row.key} className="audit-diff-row" role="row">
                  <span role="rowheader" className="audit-diff-label">
                    {row.label}
                  </span>
                  <span role="cell" className="audit-diff-before">
                    <Value value={row.before} />
                  </span>
                  <span role="cell" className="audit-diff-after">
                    <Value value={row.after} />
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {changes.fields.length ? (
            <dl className={`audit-fields${changes.diff.length ? ' is-extra' : ''}`}>
              {changes.fields.map((row) => (
                <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd>
                    <Value value={row.value} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>
      ) : null}

      {entry.entityId ? <ObjectHistory entry={entry} onShowObject={onShowObject} /> : null}

      <section className="app-split-card" aria-label="Технічні деталі">
        <details className="audit-raw">
          <summary>Технічні деталі</summary>
          {entry.details == null ? <p className="app-split-blank">Подія без деталей.</p> : <pre className="audit-pre">{JSON.stringify(entry.details, null, 2)}</pre>}
        </details>
      </section>
    </section>
  )
}

function Value({ value }: { value: AuditValue }) {
  if (value.empty) return <span className="audit-value-empty">{value.text}</span>
  if (value.list)
    return (
      <span className="audit-value-list">
        {value.list.map((item, index) => (
          <span key={`${item}-${index}`}>{item}</span>
        ))}
      </span>
    )
  return <span className={value.mono ? 'audit-value is-mono' : 'audit-value'}>{value.text}</span>
}

function ObjectHistory({ entry, onShowObject }: { entry: AuditEntry; onShowObject: (entry: AuditEntry) => void }) {
  const history = useApiQuery(`audit-object:${entry.entityType}:${entry.entityId}`, () => getAudit({ entityType: entry.entityType, q: entry.entityId ?? undefined, page: 1, pageSize: 20 }))
  const items = (history.data?.items ?? []).filter((item) => item.entityId === entry.entityId)
  const total = history.data?.totalItems ?? 0

  return (
    <section className="app-split-card" aria-labelledby="audit-object-title">
      <header className="app-split-card-head">
        <h3 id="audit-object-title">Історія об&apos;єкта</h3>
        {total > 1 ? (
          <button type="button" className="audit-card-link" onClick={() => onShowObject(entry)}>
            Показати в списку
            <IconArrowRight size={14} stroke={2} aria-hidden="true" />
          </button>
        ) : null}
      </header>
      {history.isLoading ? (
        <Skeleton height={80} radius={8} />
      ) : items.length > 1 ? (
        <AuditTimeline entries={items.slice(0, 8)} activeId={entry.id} />
      ) : (
        <p className="app-split-blank">Інших подій з цим об&apos;єктом немає.</p>
      )}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function RoleChangeCard({ change, permissionName }: { change: RoleChange; permissionName: PermissionName }) {
  return (
    <section className="app-split-card" aria-labelledby="audit-role-title">
      <header className="app-split-card-head">
        <h3 id="audit-role-title">Роль</h3>
      </header>
      <dl className="audit-fields">
        {change.kind === 'updated' ? (
          <>
            <Row label="Назва">
              {change.before.name !== change.after.name ? (
                <>
                  <span className="audit-was">{change.before.name ?? 'порожньо'}</span> → {change.after.name ?? 'порожньо'}
                </>
              ) : (
                (change.after.name ?? 'порожньо')
              )}
            </Row>
            <Row label="Опис">
              {change.before.description !== change.after.description ? (
                <>
                  <span className="audit-was">{change.before.description ?? 'порожньо'}</span> → {change.after.description ?? 'порожньо'}
                </>
              ) : (
                (change.after.description ?? 'порожньо')
              )}
            </Row>
          </>
        ) : (
          <>
            <Row label="Назва">{change.role.name ?? 'порожньо'}</Row>
            {change.kind === 'created' ? <Row label="Опис">{change.role.description ?? 'порожньо'}</Row> : null}
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
            <Row label="Знято">
              <PermissionList keys={change.removed} permissionName={permissionName} tone="removed" />
            </Row>
          </>
        ) : null}
      </dl>
    </section>
  )
}

function PermissionList({ keys, permissionName, tone }: { keys: string[]; permissionName: PermissionName; tone?: 'added' | 'removed' }) {
  if (keys.length === 0) return <span className="audit-value-empty">немає</span>
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
