import { Alert, Button, PasswordInput, Stack } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { forgetCsrf, withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'
import { notifySuccess } from '@/shared/ui/notify'
import { changeOwnPassword } from '../api/authApi'

type Fields = { currentPassword: string; newPassword: string; repeat: string }

const EMPTY: Fields = { currentPassword: '', newPassword: '', repeat: '' }

export function ChangePasswordModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [fields, setFields] = useState<Fields>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function close() {
    if (busy) return
    setFields(EMPTY)
    setErrors({})
    setFormError(null)
    onClose()
  }

  function update(name: keyof Fields, value: string) {
    setFields((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const local: Record<string, string> = {}
    if (!fields.currentPassword) local.currentPassword = 'Вкажіть поточний пароль.'
    if (!fields.newPassword) local.newPassword = 'Вкажіть новий пароль.'
    if (fields.newPassword && fields.repeat !== fields.newPassword) local.repeat = 'Паролі не збігаються.'
    if (Object.keys(local).length) {
      setErrors(local)
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      const result = await withCsrf((headers) => changeOwnPassword(headers, { currentPassword: fields.currentPassword, newPassword: fields.newPassword }))
      if (result.response.ok) {
        forgetCsrf()
        setBusy(false)
        setFields(EMPTY)
        setErrors({})
        onClose()
        notifySuccess('Пароль змінено.')
        return
      }
      const byField = fieldErrors(result.error)
      setErrors(byField)
      setFormError(Object.keys(byField).length ? 'Перевірте виділені поля.' : problemMessage(result.error, 'Пароль не змінено.'))
    } catch {
      setFormError(NETWORK_ERROR)
    }
    setBusy(false)
  }

  return (
    <AppModal opened={opened} title="Змінити пароль" onClose={close} closeOnClickOutside={!busy}>
      <form noValidate onSubmit={submit} aria-label="Змінити мій пароль">
        <Stack gap="sm">
          <PasswordInput
            label="Поточний пароль"
            autoComplete="current-password"
            value={fields.currentPassword}
            error={errors.currentPassword || undefined}
            onChange={(event) => update('currentPassword', event.currentTarget.value)}
            data-autofocus
          />
          <PasswordInput
            label="Новий пароль"
            description="Щонайменше 10 символів."
            autoComplete="new-password"
            value={fields.newPassword}
            error={errors.newPassword || undefined}
            onChange={(event) => update('newPassword', event.currentTarget.value)}
          />
          <PasswordInput
            label="Новий пароль ще раз"
            autoComplete="new-password"
            value={fields.repeat}
            error={errors.repeat || undefined}
            onChange={(event) => update('repeat', event.currentTarget.value)}
          />
          {formError ? (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
              {formError}
            </Alert>
          ) : null}
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
