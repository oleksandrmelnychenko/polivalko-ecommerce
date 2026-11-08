import { Button, Stack, Text } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { TwoFactorCodeInput } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'
import { notifySuccess } from '@/shared/ui/notify'
import { resetStaffTwoFactor, type StaffUser } from '../api/staffApi'
import { NETWORK_FAILURE, toFailure, type Failure } from '../lib/problems'
import { FailureAlert } from './FailureAlert'

const CODE_PROBLEMS = new Set(['staff.two_factor_required', 'staff.two_factor_invalid'])

type ResetTwoFactorModalProps = { user: StaffUser; superuser: boolean; onClose: () => void; onSaved: (user: StaffUser) => void }

export function ResetTwoFactorModal({ user, superuser, onClose, onSaved }: ResetTwoFactorModalProps) {
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const [failure, setFailure] = useState<Failure | null>(null)
  const [busy, setBusy] = useState(false)

  function close() {
    if (!busy) onClose()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = code.replaceAll(' ', '')
    if (superuser && !value) {
      setCodeError('Введіть код із вашого застосунку-автентифікатора.')
      return
    }
    setBusy(true)
    setFailure(null)
    try {
      const result = await withCsrf((headers) => resetStaffTwoFactor(headers, user.id, superuser ? value : null))
      if (result.data) {
        setBusy(false)
        notifySuccess(`Двофакторну перевірку для ${user.displayName} вимкнено, активні сесії завершено.`)
        onSaved(result.data)
        return
      }
      const next = toFailure(result.error, 'Перевірку не скинуто.')
      if (next.code && CODE_PROBLEMS.has(next.code)) {
        setCode('')
        setCodeError(next.detail ?? next.title)
      } else {
        setFailure(next)
      }
    } catch {
      setFailure(NETWORK_FAILURE)
    }
    setBusy(false)
  }

  return (
    <AppModal opened title={`Скинути двофакторну перевірку: ${user.displayName}`} onClose={close} closeOnClickOutside={!busy}>
      <form noValidate onSubmit={submit} aria-label={`Скинути двофакторну перевірку для ${user.email}`}>
        <Stack gap="sm">
          <Text size="sm">
            Для випадку, коли працівник втратив телефон і резервні коди. Перевірку буде вимкнено, активні сесії працівника завершаться; після входу він зможе
            налаштувати її заново.
          </Text>
          {superuser ? (
            <TwoFactorCodeInput
              label="Ваш код підтвердження"
              description="Для адміністратора потрібен код із вашого застосунку-автентифікатора."
              value={code}
              error={codeError}
              disabled={busy}
              autoFocus
              onChange={(value) => {
                setCode(value)
                setCodeError(undefined)
              }}
            />
          ) : null}
          <FailureAlert failure={failure} />
        </Stack>
        <AppModalFooter>
          <Button variant="default" disabled={busy} onClick={close}>
            Скасувати
          </Button>
          <Button type="submit" color="red" loading={busy}>
            Скинути перевірку
          </Button>
        </AppModalFooter>
      </form>
    </AppModal>
  )
}
