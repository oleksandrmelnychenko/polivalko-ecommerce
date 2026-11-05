import { Button, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import type { StaffRole } from '@/shared/auth/permissionsApi'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'
import { notifySuccess } from '@/shared/ui/notify'
import { createStaffUser, updateStaffUser, type StaffUser } from '../api/staffApi'
import { extraFieldMessages, NETWORK_FAILURE, PASSWORD_HELP, toFailure, type Failure } from '../lib/problems'
import { defaultRoleId } from '../lib/roleText'
import { FailureAlert } from './FailureAlert'
import { RoleSelect } from './RoleSelect'

const CREATE_FIELDS = ['email', 'displayName', 'roleId', 'password'] as const
const EDIT_FIELDS = ['displayName', 'roleId'] as const

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
  const [failure, setFailure] = useState<Failure | null>(null)
  const [busy, setBusy] = useState(false)
  const roleId = chosenRole ?? defaultRoleId(roles)
  const errors = failure?.fields ?? {}

  function clearField(field: string) {
    setFailure((current) => (current && current.fields[field] ? { ...current, fields: { ...current.fields, [field]: '' } } : current))
  }

  function close() {
    if (!busy) onClose()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailure(null)
    try {
      const result = user
        ? await withCsrf((headers) => updateStaffUser(headers, user.id, { displayName: displayName.trim(), roleId: roleId || null }))
        : await withCsrf((headers) => createStaffUser(headers, { email: email.trim(), displayName: displayName.trim(), roleId: roleId || null, password }))
      if (result.data) {
        setBusy(false)
        notifySuccess(
          user ? `Дані працівника ${result.data.displayName} збережено.` : `Працівника ${result.data.displayName} додано. Передайте йому пароль особисто.`,
        )
        onSaved(result.data)
        return
      }
      setFailure(toFailure(result.error, user ? 'Зміни не збережено.' : 'Працівника не додано.'))
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
          <FailureAlert failure={failure} extra={extraFieldMessages(failure, shown)} />
        </Stack>
        <AppModalFooter>
          <Button variant="default" disabled={busy} onClick={close}>
            Скасувати
          </Button>
          <Button type="submit" loading={busy}>
            {user ? 'Зберегти' : 'Додати працівника'}
          </Button>
        </AppModalFooter>
      </form>
    </AppModal>
  )
}
