import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconArrowRight } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import { TwoFactorCodeInput } from '../components/TwoFactorCodeInput'
import { consumeReturnPath, sanitizeReturnPath, toPath, type ReturnLocation } from '../lib/authReturnPath'
import { useAuth } from '../useAuth'
import './login.css'

type LoginLocationState = { from?: ReturnLocation } | null

export function LoginPage() {
  const { status, login } = useAuth()
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
      const missing = { email: email.trim() ? undefined : 'Вкажіть email.', password: password ? undefined : 'Вкажіть пароль.' }
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
  }

  return (
    <main className="login-page">
      <div className="login-content">
        <header className="login-brand">
          <span className="login-wordmark" translate="no">
            PoliValko
          </span>
          <span className="login-badge">консоль</span>
        </header>

        <section className="login-card" aria-labelledby="login-title">
          <div className="login-heading">
            <h1 id="login-title">{codeStep ? 'Підтвердження входу' : 'Вхід для працівників'}</h1>
            <p>{codeStep ? `Для ${email.trim()} увімкнено двофакторну перевірку.` : 'Замовлення, каталог, контент і стан інтеграцій магазину.'}</p>
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
                    disabled={busy}
                    autoFocus
                    onChange={(value) => {
                      setCode(value)
                      setFieldError({})
                    }}
                  />
                  <Button variant="subtle" size="compact-sm" className="login-switch" disabled={busy} onClick={switchCodeKind}>
                    {recovery ? 'Ввести код із застосунку' : 'Немає телефону? Резервний код'}
                  </Button>
                </>
              ) : (
                <>
                  <TextInput
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    error={fieldError.email}
                    disabled={busy}
                    onChange={(event) => setEmail(event.currentTarget.value)}
                    data-autofocus
                  />
                  <PasswordInput
                    label="Пароль"
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    error={fieldError.password}
                    disabled={busy}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                  />
                </>
              )}
              {error ? (
                <Alert className="login-alert" color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
                  {error}
                </Alert>
              ) : null}
              <Button className="login-submit" type="submit" fullWidth loading={busy} disabled={status === 'loading'} rightSection={<IconArrowRight size={18} stroke={1.8} />}>
                {codeStep ? 'Підтвердити' : 'Увійти'}
              </Button>
              {codeStep ? (
                <Button variant="default" fullWidth disabled={busy} leftSection={<IconArrowLeft size={16} stroke={1.8} />} onClick={backToPassword}>
                  Інший обліковий запис
                </Button>
              ) : null}
            </Stack>
          </form>

          <p className="login-help">Доступ видає працівник з роллю «Адміністратор».</p>
        </section>
      </div>
    </main>
  )
}
