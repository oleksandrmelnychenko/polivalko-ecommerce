import { Button, PasswordInput, Stack, TextInput } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconArrowRight, IconKey, IconWifiOff } from '@tabler/icons-react'
import Image from 'next/image'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import { TwoFactorCodeInput } from '../components/TwoFactorCodeInput'
import { invalidCodeMessage, lockedOutMessage } from '../lib/loginErrors'
import { consumeReturnPath, sanitizeReturnPath, toPath, type ReturnLocation } from '../lib/authReturnPath'
import { useAuth } from '../useAuth'
import './login.css'

type LoginLocationState = { from?: ReturnLocation } | null
const emailRequired = 'Введіть електронну пошту.'
const passwordRequired = 'Введіть пароль.'

export function LoginPage() {
  const { status, reconnecting, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string; code?: string }>({})
  const [codeStep, setCodeStep] = useState(false)
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [busy, setBusy] = useState(false)
  useDocumentTitle('Вхід')

  const from = (location.state as LoginLocationState)?.from

  if (status === 'authenticated' && !busy) {
    return <Navigate to={(from && sanitizeReturnPath(toPath(from))) || '/'} replace />
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (codeStep) {
      if (!code.trim()) {
        setFieldError({ code: recovery ? 'Введіть резервний код.' : 'Введіть код із застосунку.' })
        return
      }
    } else {
      const missing = { email: email.trim() ? undefined : emailRequired, password: password ? undefined : passwordRequired }
      setFieldError(missing)
      if (missing.email || missing.password) return
    }
    setBusy(true)
    setError(null)
    const result = await login(email.trim(), password, codeStep ? code.replaceAll(' ', '') : undefined)
    if (result.ok) {
      navigate((from && sanitizeReturnPath(toPath(from))) || consumeReturnPath('/'), { replace: true })
      return
    }
    setBusy(false)
    if (result.twoFactor === 'required' && !codeStep) {
      setCodeStep(true)
      setFieldError({})
      return
    }
    if (result.twoFactor === 'invalid') {
      setCode('')
      setFieldError({ code: result.message })
      return
    }
    setError(result.message)
  }

  function backToPassword() {
    setCodeStep(false)
    setCode('')
    setRecovery(false)
    setPassword('')
    setFieldError({})
    setError(null)
  }

  function switchCodeKind() {
    setRecovery((current) => !current)
    setCode('')
    setFieldError({})
    setError(null)
  }

  function clearFeedback(field: keyof typeof fieldError) {
    if (fieldError[field]) setFieldError((current) => ({ ...current, [field]: undefined }))
    if (error) setError(null)
  }

  return (
    <main className="login-page">
      <div className="login-content">
        <header className="login-brand-panel">
          <div className="login-brand" translate="no">
            <Image className="login-brand-mascot" src="/mascot/poli-valka-poster.png" width={125} height={200} alt="" unoptimized />
            <span className="login-wordmark">
              <strong>Poli-Valko</strong>
              <span>Дім · сад · город</span>
            </span>
          </div>
          <div className="login-orbit" aria-hidden="true">
            {Array.from({ length: 23 }, (_, index) => (
              <i key={index} style={{ transform: `rotate(${index * 5 - 55}deg) scale(${1 - index * .017})` }} />
            ))}
          </div>
          <p className="login-panel-title">Консоль<br />працівників<span aria-hidden="true">.</span></p>
        </header>

        <section className="login-card" aria-labelledby="login-title">
          <div className="login-heading">
            <h1 id="login-title">{codeStep ? 'Підтвердження входу' : 'Вхід'}</h1>
            <p>{codeStep ? `Для ${email.trim()} увімкнено двофакторну перевірку.` : 'Введіть робочу пошту та пароль.'}</p>
          </div>

          <form noValidate aria-busy={busy} onSubmit={submit}>
            <Stack gap={14}>
              {codeStep ? (
                <>
                  <TwoFactorCodeInput
                    key={recovery ? 'recovery' : 'app'}
                    label={recovery ? 'Резервний код' : 'Код із застосунку'}
                    description={recovery ? 'Кожен резервний код спрацьовує один раз.' : 'Шість цифр із застосунку-автентифікатора на телефоні.'}
                    value={code}
                    recovery={recovery}
                    error={fieldError.code}
                    errorSpace={invalidCodeMessage}
                    disabled={busy}
                    autoFocus
                    onChange={(value) => {
                      setCode(value)
                      clearFeedback('code')
                    }}
                  />
                  <Button variant="subtle" size="compact-sm" className="login-switch" disabled={busy} onClick={switchCodeKind}>
                    {recovery ? 'Ввести код із застосунку' : 'Немає телефону? Резервний код'}
                  </Button>
                </>
              ) : (
                <>
                  <TextInput
                    label="Електронна пошта"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    error={fieldError.email}
                    wrapperProps={{ 'data-error-space': emailRequired }}
                    disabled={busy}
                    onChange={(event) => {
                      setEmail(event.currentTarget.value)
                      clearFeedback('email')
                    }}
                    data-autofocus
                  />
                  <PasswordInput
                    label="Пароль"
                    name="password"
                    visibilityToggleButtonProps={{ 'aria-label': 'Показати або приховати пароль' }}
                    autoComplete="current-password"
                    value={password}
                    error={fieldError.password}
                    wrapperProps={{ 'data-error-space': passwordRequired }}
                    disabled={busy}
                    onChange={(event) => {
                      setPassword(event.currentTarget.value)
                      clearFeedback('password')
                    }}
                  />
                </>
              )}
              <Button
                className="login-submit"
                type="submit"
                fullWidth
                loading={busy}
                disabled={status === 'loading' && !reconnecting}
                rightSection={<IconArrowRight size={18} stroke={1.8} />}
              >
                {codeStep ? 'Підтвердити' : 'Увійти'}
              </Button>
              {codeStep ? (
                <Button variant="default" fullWidth disabled={busy} leftSection={<IconArrowLeft size={16} stroke={1.8} />} onClick={backToPassword}>
                  Інший обліковий запис
                </Button>
              ) : null}
            </Stack>
          </form>

          <div className="login-feedback-slot">
            <span className="login-feedback-measure" aria-hidden="true">{lockedOutMessage}</span>
            {error ? (
              <p className="login-feedback" role="alert">
                <IconAlertCircle size={17} stroke={1.7} aria-hidden="true" />
                {error}
              </p>
            ) : reconnecting ? (
              <p className="login-feedback" role="status">
                <IconWifiOff size={17} stroke={1.7} aria-hidden="true" />
                Сервер не відповідає. Пробуємо з&apos;єднатися ще раз…
              </p>
            ) : (
              <p className="login-help"><IconKey size={16} stroke={1.6} aria-hidden="true" />Доступ надає адміністратор магазину.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
