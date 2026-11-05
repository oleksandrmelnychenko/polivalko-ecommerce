import { Button, PasswordInput, Stack } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'
import { notifySuccess } from '@/shared/ui/notify'
import { resetStaffPassword, type StaffUser } from '../api/staffApi'
import { extraFieldMessages, NETWORK_FAILURE, PASSWORD_HELP, toFailure, type Failure } from '../lib/problems'
import { FailureAlert } from './FailureAlert'

export function ResetPasswordModal({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [failure, setFailure] = useState<Failure | null>(null)
  const [busy, setBusy] = useState(false)

  function close() {
    if (!busy) onClose()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailure(null)
    try {
      const result = await withCsrf((headers) => resetStaffPassword(headers, user.id, password))
      if (result.response.ok) {
        setBusy(false)
        notifySuccess(`Пароль для ${user.displayName} змінено, активні сесії завершено.`)
        onClose()
        return
      }
      setFailure(toFailure(result.error, 'Пароль не змінено.'))
    } catch {
      setFailure(NETWORK_FAILURE)
    }
    setBusy(false)
  }

  return (
    <AppModal opened title={`Новий пароль: ${user.displayName}`} onClose={close} closeOnClickOutside={!busy}>
      <form noValidate onSubmit={submit} aria-label={`Новий пароль для ${user.email}`}>
        <Stack gap="sm">
          <PasswordInput
            label={`Новий пароль для ${user.displayName}`}
            description={`${PASSWORD_HELP} Активні сесії працівника завершаться.`}
            autoComplete="new-password"
            value={password}
            error={failure?.fields.password || undefined}
            onChange={(event) => {
              setPassword(event.currentTarget.value)
              setFailure((current) => (current?.fields.password ? { ...current, fields: { ...current.fields, password: '' } } : current))
            }}
            data-autofocus
          />
          <FailureAlert failure={failure} extra={extraFieldMessages(failure, ['password'])} />
        </Stack>
        <AppModalFooter>
          <Button variant="default" disabled={busy} onClick={close}>
            Скасувати
          </Button>
          <Button type="submit" loading={busy}>
            Змінити пароль
          </Button>
        </AppModalFooter>
      </form>
    </AppModal>
  )
}
