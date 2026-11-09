import { Alert, Button, Group, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { IconShieldLock } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { TwoFactorCodeInput, TwoFactorModal, useTwoFactorStatus } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import type { StaffRole } from '@/shared/auth/permissionsApi'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'
import { notifySuccess } from '@/shared/ui/notify'
import { createStaffUser, updateStaffUser, type StaffUser } from '../api/staffApi'
import { extraFieldMessages, NETWORK_FAILURE, PASSWORD_HELP, toFailure, type Failure } from '../lib/problems'
import { defaultRoleId } from '../lib/roleText'
import { FailureAlert } from './FailureAlert'
import { RoleSelect } from './RoleSelect'

const CREATE_FIELDS = ['email', 'displayName', 'roleId', 'password', 'twoFactorCode'] as const
const EDIT_FIELDS = ['displayName', 'roleId', 'twoFactorCode'] as const
const CODE_PROBLEMS = new Set(['staff.two_factor_required', 'staff.two_factor_invalid'])

type StaffUserModalProps = {
  user: StaffUser | null
  roles: readonly StaffRole[]
  rolesLoading: boolean
  canGrantSuperuser: boolean
  onClose: () => void
  onSaved: (user: StaffUser) => void
}

export function StaffUserModal({ user, roles, rolesLoading, canGrantSuperuser, onClose, onSaved }: StaffUserModalProps) {
  const editing = user !== null
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [chosenRole, setChosenRole] = useState<string | null>(user?.roleId ?? null)
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorOpened, setTwoFactorOpened] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [busy, setBusy] = useState(false)
  const roleId = chosenRole ?? defaultRoleId(roles)
  const errors = failure?.fields ?? {}
  const grantsSuperuser = Boolean(roles.find((role) => role.id === roleId)?.isSuperuser) && roleId !== user?.roleId
  const twoFactor = useTwoFactorStatus(grantsSuperuser)
  const needsSetup = grantsSuperuser && twoFactor.data?.enabled === false

  function clearField(field: string) {
    setFailure((current) => (current && current.fields[field] ? { ...current, fields: { ...current.fields, [field]: '' } } : current))
  }

  function close() {
    if (!busy) onClose()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const code = grantsSuperuser ? twoFactorCode.replaceAll(' ', '') || null : null
    if (grantsSuperuser && !needsSetup && !code) {
      setFailure({ title: '', fields: { twoFactorCode: 'Введіть код із вашого застосунку-автентифікатора.' } })
      return
    }
    setBusy(true)
    setFailure(null)
    try {
      const result = user
        ? await withCsrf((headers) => updateStaffUser(headers, user.id, { displayName: displayName.trim(), roleId: roleId || null, twoFactorCode: code }))
        : await withCsrf((headers) => createStaffUser(headers, { email: email.trim(), displayName: displayName.trim(), roleId: roleId || null, password, twoFactorCode: code }))
      if (result.data) {
        setBusy(false)
        notifySuccess(
          user ? `Дані працівника ${result.data.displayName} збережено.` : `Працівника ${result.data.displayName} додано. Передайте йому пароль особисто.`,
        )
        onSaved(result.data)
        return
      }
      const next = toFailure(result.error, user ? 'Зміни не збережено.' : 'Працівника не додано.')
      if (next.code && CODE_PROBLEMS.has(next.code)) {
        setTwoFactorCode('')
        setFailure({ title: '', fields: { twoFactorCode: next.detail ?? next.title } })
      } else {
        if (next.code === 'staff.two_factor_setup_required') twoFactor.reload()
        setFailure(next)
      }
    } catch {
      setFailure(NETWORK_FAILURE)
    }
    setBusy(false)
  }

  const shown = editing ? EDIT_FIELDS : CREATE_FIELDS

  return (
    <AppModal opened title={user ? `Дані працівника: ${user.displayName}` : 'Новий працівник'} onClose={close} closeOnClickOutside={!busy}>
      <form noValidate onSubmit={submit} aria-label={user ? `Дані працівника ${user.email}` : 'Новий працівник'}>
        <Stack gap="sm">
          {user ? (
            <Text size="sm" c="dimmed">
              {user.email}
            </Text>
          ) : (
            <>
              <Text size="sm" c="dimmed">
                Пароль новому працівнику передайте особисто.
              </Text>
              <TextInput
                label="Робочий email"
                type="email"
                autoComplete="off"
                maxLength={200}
                value={email}
                error={errors.email || undefined}
                onChange={(event) => {
                  setEmail(event.currentTarget.value)
                  clearField('email')
                }}
                data-autofocus
              />
            </>
          )}
          <TextInput
            label="Ім'я"
            description={user ? undefined : 'Видно в історії замовлень і журналі.'}
            autoComplete="off"
            maxLength={100}
            value={displayName}
            error={errors.displayName || undefined}
            onChange={(event) => {
              setDisplayName(event.currentTarget.value)
              clearField('displayName')
            }}
            data-autofocus={user ? true : undefined}
          />
          <RoleSelect
            roles={roles}
            value={roleId}
            loading={rolesLoading}
            canGrantSuperuser={canGrantSuperuser}
            description={user ? 'Зміна ролі завершує активні сесії працівника.' : undefined}
            error={errors.roleId || undefined}
            onChange={(value) => {
              setChosenRole(value)
              clearField('roleId')
            }}
          />
          {user ? null : (
            <PasswordInput
              label="Початковий пароль"
              description={PASSWORD_HELP}
              autoComplete="new-password"
              value={password}
              error={errors.password || undefined}
              onChange={(event) => {
                setPassword(event.currentTarget.value)
                clearField('password')
              }}
            />
          )}
          {grantsSuperuser ? (
            needsSetup ? (
              <Alert color="yellow" variant="light" icon={<IconShieldLock size={18} />} title="Потрібна двофакторна перевірка">
                <Stack gap={8}>
                  <span>Щоб призначити роль адміністратора, підтвердьте дію кодом із вашого телефону. Спершу увімкніть двофакторну перевірку для себе.</span>
                  <Group>
                    <Button size="xs" onClick={() => setTwoFactorOpened(true)}>
                      Налаштувати перевірку
                    </Button>
                  </Group>
                </Stack>
              </Alert>
            ) : (
              <TwoFactorCodeInput
                label="Ваш код підтвердження"
                description="Щоб призначити роль адміністратора, введіть код із вашого застосунку-автентифікатора."
                value={twoFactorCode}
                error={errors.twoFactorCode || undefined}
                disabled={busy || twoFactor.isLoading}
                onChange={(value) => {
                  setTwoFactorCode(value)
                  clearField('twoFactorCode')
                }}
              />
            )
          ) : null}
          <FailureAlert failure={failure} extra={extraFieldMessages(failure, shown)} />
        </Stack>
        <AppModalFooter>
          <Button variant="default" disabled={busy} onClick={close}>
            Скасувати
          </Button>
          <Button type="submit" loading={busy} disabled={needsSetup}>
            {user ? 'Зберегти зміни' : 'Додати працівника'}
          </Button>
        </AppModalFooter>
      </form>
      <TwoFactorModal opened={twoFactorOpened} onClose={() => setTwoFactorOpened(false)} onChanged={twoFactor.reload} />
    </AppModal>
  )
}
