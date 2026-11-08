import { Alert, Button, Group, Loader, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconCopy, IconDownload, IconShieldCheck } from '@tabler/icons-react'
import QRCode from 'qrcode'
import { useEffect, useState, type FormEvent } from 'react'
import { forgetCsrf, withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'
import { notifySuccess } from '@/shared/ui/notify'
import { disableTwoFactor, enableTwoFactor, regenerateRecoveryCodes, startTwoFactorSetup, type TwoFactorSetup } from '../api/authApi'
import { useTwoFactorStatus } from '../useTwoFactorStatus'
import { TwoFactorCodeInput } from './TwoFactorCodeInput'
import './two-factor.css'

type Step = { kind: 'overview' } | { kind: 'scan'; setup: TwoFactorSetup; qr: string | null } | { kind: 'codes'; codes: string[]; fresh: boolean }

type TwoFactorModalProps = { opened: boolean; onClose: () => void; onChanged?: () => void }

export function TwoFactorModal({ opened, onClose, onChanged }: TwoFactorModalProps) {
  const status = useTwoFactorStatus(opened)
  const [step, setStep] = useState<Step>({ kind: 'overview' })
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'setup' | 'enable' | 'codes' | 'disable' | null>(null)
  const enabled = status.data?.enabled ?? false

  useEffect(() => {
    if (step.kind !== 'scan' || step.qr) return undefined
    let cancelled = false
    QRCode.toDataURL(step.setup.authenticatorUri, { margin: 1, width: 368, errorCorrectionLevel: 'M' })
      .then((qr) => {
        if (!cancelled) setStep((current) => (current.kind === 'scan' ? { ...current, qr } : current))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [step])

  function resetForm() {
    setCode('')
    setCodeError(undefined)
    setFormError(null)
  }

  function close() {
    if (busy) return
    resetForm()
    setStep({ kind: 'overview' })
    onClose()
  }

  function fail(error: unknown, fallback: string) {
    const byField = fieldErrors(error)
    if (byField.code) {
      setCodeError(byField.code)
      setFormError(null)
      return
    }
    setFormError(problemMessage(error, fallback))
  }

  async function startSetup() {
    setBusy('setup')
    resetForm()
    try {
      const result = await withCsrf((headers) => startTwoFactorSetup(headers))
      if (result.data) {
        forgetCsrf()
        setStep({ kind: 'scan', setup: result.data, qr: null })
      } else {
        fail(result.error, 'Не вдалося почати налаштування.')
      }
    } catch {
      setFormError(NETWORK_ERROR)
    }
    setBusy(null)
  }

  function requireCode(): string | null {
    const value = code.replace(/\s/g, '')
    if (value.length !== 6) {
      setCodeError('Введіть шість цифр із застосунку.')
      return null
    }
    return value
  }

  async function enable(event: FormEvent) {
    event.preventDefault()
    const value = requireCode()
    if (!value) return
    setBusy('enable')
    setFormError(null)
    try {
      const result = await withCsrf((headers) => enableTwoFactor(headers, value))
      if (result.data) {
        forgetCsrf()
        resetForm()
        setStep({ kind: 'codes', codes: [...result.data.recoveryCodes], fresh: true })
        status.reload()
        onChanged?.()
      } else {
        fail(result.error, 'Перевірку не ввімкнено.')
      }
    } catch {
      setFormError(NETWORK_ERROR)
    }
    setBusy(null)
  }

  async function newCodes() {
    const value = requireCode()
    if (!value) return
    setBusy('codes')
    setFormError(null)
    try {
      const result = await withCsrf((headers) => regenerateRecoveryCodes(headers, value))
      if (result.data) {
        resetForm()
        setStep({ kind: 'codes', codes: [...result.data.recoveryCodes], fresh: false })
        status.reload()
      } else {
        fail(result.error, 'Нові коди не створено.')
      }
    } catch {
      setFormError(NETWORK_ERROR)
    }
    setBusy(null)
  }

  async function disable() {
    const value = requireCode()
    if (!value) return
    setBusy('disable')
    setFormError(null)
    try {
      const result = await withCsrf((headers) => disableTwoFactor(headers, value))
      if (result.response.ok) {
        forgetCsrf()
        resetForm()
        status.reload()
        onChanged?.()
        notifySuccess('Двофакторну перевірку вимкнено.')
      } else {
        fail(result.error, 'Перевірку не вимкнено.')
      }
    } catch {
      setFormError(NETWORK_ERROR)
    }
    setBusy(null)
  }

  const errorAlert = formError ? (
    <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
      {formError}
    </Alert>
  ) : null

  return (
    <AppModal opened={opened} title="Двофакторна перевірка" onClose={close} closeOnClickOutside={!busy}>
      {step.kind === 'codes' ? (
        <RecoveryCodes codes={step.codes} fresh={step.fresh} onDone={close} />
      ) : step.kind === 'scan' ? (
        <form noValidate onSubmit={enable} aria-label="Налаштування застосунку-автентифікатора">
          <Stack gap="sm">
            <Text size="sm">
              1. Відкрийте застосунок-автентифікатор на телефоні (Google Authenticator, Microsoft Authenticator, 1Password чи інший) і відскануйте код.
            </Text>
            <div className="two-factor-qr">
              {step.qr ? <img src={step.qr} width={184} height={184} alt="QR-код для застосунку-автентифікатора" /> : <Loader size="sm" />}
            </div>
            <Text size="sm" c="dimmed">
              Не сканується? Додайте вручну ключ:
            </Text>
            <code className="two-factor-key" translate="no">
              {step.setup.sharedKey}
            </code>
            <Text size="sm">2. Введіть шестизначний код, який показав застосунок.</Text>
            <TwoFactorCodeInput
              value={code}
              error={codeError}
              disabled={busy !== null}
              autoFocus
              onChange={(value) => {
                setCode(value)
                setCodeError(undefined)
              }}
            />
            {errorAlert}
          </Stack>
          <AppModalFooter>
            <Button variant="default" disabled={busy !== null} onClick={close}>
              Скасувати
            </Button>
            <Button type="submit" loading={busy === 'enable'}>
              Увімкнути
            </Button>
          </AppModalFooter>
        </form>
      ) : status.isLoading || !status.data ? (
        status.status === 'error' ? (
          <Stack gap="sm">
            <Text size="sm">{problemMessage(status.problem, 'Не вдалося завантажити стан перевірки.')}</Text>
            <Group>
              <Button size="xs" variant="default" onClick={status.reload}>
                Спробувати ще раз
              </Button>
            </Group>
          </Stack>
        ) : (
          <Group justify="center" py="lg">
            <Loader size="sm" />
          </Group>
        )
      ) : enabled ? (
        <Stack gap="sm">
          <Alert color="green" variant="light" icon={<IconShieldCheck size={18} />}>
            Увімкнено. Під час входу консоль питає код із застосунку. Резервних кодів лишилося: {status.data.recoveryCodesLeft}.
          </Alert>
          <TwoFactorCodeInput
            value={code}
            error={codeError}
            disabled={busy !== null}
            description="Потрібен для нових резервних кодів і для вимкнення."
            onChange={(value) => {
              setCode(value)
              setCodeError(undefined)
            }}
          />
          {errorAlert}
          <AppModalFooter>
            <Button variant="light" color="red" loading={busy === 'disable'} disabled={busy !== null && busy !== 'disable'} onClick={() => void disable()}>
              Вимкнути
            </Button>
            <Button variant="default" loading={busy === 'codes'} disabled={busy !== null && busy !== 'codes'} onClick={() => void newCodes()}>
              Нові резервні коди
            </Button>
          </AppModalFooter>
        </Stack>
      ) : (
        <Stack gap="sm">
          <Text size="sm">
            Після ввімкнення консоль під час входу питатиме, крім пароля, шестизначний код із застосунку на вашому телефоні. Без перевірки не можна
            створювати адміністраторів і призначати роль адміністратора.
          </Text>
          {errorAlert}
          <AppModalFooter>
            <Button variant="default" disabled={busy !== null} onClick={close}>
              Не зараз
            </Button>
            <Button loading={busy === 'setup'} onClick={() => void startSetup()}>
              Налаштувати
            </Button>
          </AppModalFooter>
        </Stack>
      )}
    </AppModal>
  )
}

function RecoveryCodes({ codes, fresh, onDone }: { codes: string[]; fresh: boolean; onDone: () => void }) {
  const text = codes.join('\n')

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      notifySuccess('Резервні коди скопійовано.')
    } catch {
      return
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([`Poli Valko, консоль: резервні коди\n\n${text}\n`], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'polivalko-recovery-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Stack gap="sm">
      <Alert color="green" variant="light" icon={<IconShieldCheck size={18} />}>
        {fresh ? 'Двофакторну перевірку ввімкнено.' : 'Попередні резервні коди більше не діють.'}
      </Alert>
      <Text size="sm">
        Резервні коди знадобляться, якщо телефону не буде під рукою: кожен спрацьовує один раз замість коду із застосунку. Збережіть їх у надійному місці, більше
        їх не покажемо.
      </Text>
      <ol className="two-factor-codes" translate="no">
        {codes.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
      <AppModalFooter>
        <Button variant="default" leftSection={<IconCopy size={16} />} onClick={() => void copy()}>
          Скопіювати
        </Button>
        <Button variant="default" leftSection={<IconDownload size={16} />} onClick={download}>
          Завантажити
        </Button>
        <Button onClick={onDone}>Готово</Button>
      </AppModalFooter>
    </Stack>
  )
}
