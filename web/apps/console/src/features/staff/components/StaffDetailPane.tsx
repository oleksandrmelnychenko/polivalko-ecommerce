import { Button, Skeleton } from '@mantine/core'
import { IconArrowRight, IconFolder, IconKey, IconLock, IconLockOpen, IconPencil, IconShieldOff } from '@tabler/icons-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { getAudit } from '@/shared/audit/auditApi'
import { AuditTimeline } from '@/shared/audit/AuditTimeline'
import { getPermissionCatalog, getRolePermissions, type StaffRole } from '@/shared/auth/permissionsApi'
import type { StaffUser } from '../api/staffApi'
import { rightsText } from '../lib/roleText'
import { StaffAvatar } from './StaffAvatar'

const HISTORY_SIZE = 8

type StaffDetailPaneProps = {
  user: StaffUser | null
  role: StaffRole | undefined
  isSelf: boolean
  busy: boolean
  canOpenRoles: boolean
  canViewAudit: boolean
  onEdit: (user: StaffUser) => void
  onPassword: (user: StaffUser) => void
  onResetTwoFactor: (user: StaffUser) => void
  onLock: (user: StaffUser) => void
}

export function StaffDetailPane(props: StaffDetailPaneProps) {
  const { user, role, isSelf, busy, canOpenRoles, canViewAudit } = props
  if (!user) return <section className="app-split-detail app-split-detail-empty">Оберіть працівника зліва.</section>

  return (
    <section key={user.id} className="app-split-detail" aria-labelledby="staff-detail-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <StaffAvatar name={user.displayName} size="lg" locked={user.lockedOut} />
            <div className="app-split-hero-main">
              <p className="app-split-hero-kicker">{isSelf ? 'Ваш обліковий запис' : 'Працівник'}</p>
              <h2 id="staff-detail-title">{user.displayName}</h2>
              <p className="app-split-hero-aliases">
                <a className="staff-email" href={`mailto:${user.email}`}>
                  {user.email}
                </a>
              </p>
            </div>
          </div>
          <div className="app-split-actions staff-actions">
            <Button variant="default" leftSection={<IconPencil size={16} stroke={1.7} />} onClick={() => props.onEdit(user)}>
              Змінити
            </Button>
            <Button variant="default" leftSection={<IconKey size={16} stroke={1.7} />} onClick={() => props.onPassword(user)}>
              Новий пароль
            </Button>
          </div>
        </div>

        <dl className="app-split-stats staff-stats">
          <div>
            <dt>Доступ</dt>
            <dd className={user.lockedOut ? 'is-bad' : 'is-good'}>
              {user.lockedOut ? 'Заблоковано' : 'Активний'}
              <small>{user.lockedOut ? 'вхід закрито' : 'може входити'}</small>
            </dd>
          </div>
          <div>
            <dt>Двофакторна перевірка</dt>
            <dd className={user.twoFactorEnabled ? 'is-good' : undefined}>
              {user.twoFactorEnabled ? 'Увімкнено' : 'Вимкнено'}
              <small>{user.twoFactorEnabled ? 'пароль і код' : 'лише пароль'}</small>
            </dd>
          </div>
          <div>
            <dt>Роль</dt>
            <dd>
              {user.roleName}
              {role ? <small>{role.isSuperuser ? 'усі права' : rightsText(role.permissionCount)}</small> : null}
            </dd>
          </div>
        </dl>

        <div className="staff-hero-bar">
          {user.twoFactorEnabled && !isSelf ? (
            <Button size="xs" variant="subtle" color="gray" leftSection={<IconShieldOff size={15} stroke={1.7} />} onClick={() => props.onResetTwoFactor(user)}>
              Скинути двофакторну перевірку
            </Button>
          ) : null}
          {isSelf ? null : (
            <Button
              size="xs"
              variant={user.lockedOut ? 'default' : 'light'}
              color={user.lockedOut ? 'gray' : 'red'}
              leftSection={user.lockedOut ? <IconLockOpen size={15} stroke={1.7} /> : <IconLock size={15} stroke={1.7} />}
              loading={busy}
              onClick={() => props.onLock(user)}
            >
              {user.lockedOut ? 'Розблокувати доступ' : 'Заблокувати доступ'}
            </Button>
          )}
        </div>
      </header>

      <RoleCard user={user} role={role} canOpenRoles={canOpenRoles} />

      {canViewAudit ? <AccountHistory user={user} /> : null}
      {canViewAudit ? <UserActions user={user} /> : null}
    </section>
  )
}

function RoleCard({ user, role, canOpenRoles }: { user: StaffUser; role: StaffRole | undefined; canOpenRoles: boolean }) {
  const load = canOpenRoles && Boolean(role) && !role?.isSuperuser
  const permissions = useApiQuery(`staff-role-permissions:${user.roleId}`, () => getRolePermissions(user.roleId), { enabled: load })
  const catalog = useApiQuery('permission-catalog', () => getPermissionCatalog(), { enabled: load })

  const sections = useMemo(() => {
    const granted = new Set(permissions.data?.permissionKeys ?? [])
    const groups = new Map<string, string[]>()
    for (const permission of catalog.data?.permissions ?? []) {
      if (!granted.has(permission.key)) continue
      const list = groups.get(permission.sectionLabel) ?? []
      list.push(permission.name)
      groups.set(permission.sectionLabel, list)
    }
    return [...groups.entries()]
  }, [permissions.data, catalog.data])

  return (
    <section className="app-split-card" aria-labelledby="staff-role-title">
      <header className="app-split-card-head">
        <h3 id="staff-role-title">Права ролі «{user.roleName}»</h3>
        {canOpenRoles ? (
          <Link className="staff-card-link" to={`/system/roles?role=${encodeURIComponent(user.roleId)}`}>
            Налаштувати роль
            <IconArrowRight size={14} stroke={2} aria-hidden="true" />
          </Link>
        ) : null}
      </header>
      {role?.description ? <p className="staff-role-description">{role.description}</p> : null}
      {role?.isSuperuser ? (
        <p className="app-split-blank">Роль має всі права консолі.</p>
      ) : !canOpenRoles ? (
        <p className="app-split-blank">{role ? `${rightsText(role.permissionCount)}. Перелік бачать ті, хто має право «Ролі та права».` : 'Перелік прав бачать ті, хто має право «Ролі та права».'}</p>
      ) : permissions.isLoading || catalog.isLoading ? (
        <Skeleton height={90} radius={10} />
      ) : sections.length ? (
        <div className="app-split-sections">
          {sections.map(([section, names]) => (
            <div key={section} className="app-split-section">
              <p className="app-split-section-head">
                <IconFolder size={15} stroke={1.8} aria-hidden="true" />
                <span>{section}</span>
                <em>{names.length}</em>
              </p>
              <ul className="app-split-tags">
                {names.map((name) => (
                  <li key={name}>
                    <span className="app-split-tag-name">{name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="app-split-blank">У ролі немає жодного права.</p>
      )}
    </section>
  )
}

function AccountHistory({ user }: { user: StaffUser }) {
  const history = useApiQuery(`staff-account-history:${user.email}`, () => getAudit({ entityType: 'StaffUser', q: user.email, page: 1, pageSize: 20 }))
  const items = (history.data?.items ?? []).filter((entry) => entry.entityId?.toLowerCase() === user.email.toLowerCase())

  return (
    <section className="app-split-card" aria-labelledby="staff-history-title">
      <header className="app-split-card-head">
        <h3 id="staff-history-title">Історія облікового запису</h3>
        {items.length ? (
          <Link className="staff-card-link" to={`/system/audit?entityType=StaffUser&q=${encodeURIComponent(user.email)}`}>
            У журналі
            <IconArrowRight size={14} stroke={2} aria-hidden="true" />
          </Link>
        ) : null}
      </header>
      {history.isLoading ? (
        <Skeleton height={80} radius={8} />
      ) : items.length ? (
        <AuditTimeline entries={items.slice(0, HISTORY_SIZE)} />
      ) : (
        <p className="app-split-blank">Змін облікового запису в журналі немає.</p>
      )}
    </section>
  )
}

function UserActions({ user }: { user: StaffUser }) {
  const actions = useApiQuery(`staff-user-actions:${user.displayName}`, () => getAudit({ q: user.displayName, page: 1, pageSize: 50 }))
  const items = (actions.data?.items ?? []).filter((entry) => entry.actor === user.displayName)

  return (
    <section className="app-split-card" aria-labelledby="staff-actions-title">
      <header className="app-split-card-head">
        <h3 id="staff-actions-title">Останні дії в консолі</h3>
        {items.length ? (
          <Link className="staff-card-link" to={`/system/audit?q=${encodeURIComponent(user.displayName)}`}>
            У журналі
            <IconArrowRight size={14} stroke={2} aria-hidden="true" />
          </Link>
        ) : null}
      </header>
      {actions.isLoading ? (
        <Skeleton height={80} radius={8} />
      ) : items.length ? (
        <AuditTimeline entries={items.slice(0, HISTORY_SIZE)} showActor={false} showObject />
      ) : (
        <p className="app-split-blank">Змін від імені цього працівника в журналі немає.</p>
      )}
    </section>
  )
}
