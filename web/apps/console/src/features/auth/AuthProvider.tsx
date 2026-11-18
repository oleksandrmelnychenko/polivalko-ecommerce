import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { useLocation } from 'react-router-dom'
import type { Problem } from '@/shared/api/problem'
import { forgetCsrf, withCsrf } from '@/shared/api/csrf'
import { hasPermission as checkPermission } from '@/shared/auth/permissions'
import { getMyPermissions, type MyPermissions, type StaffMe } from '@/shared/auth/permissionsApi'
import { onConsoleEvent } from '@/shared/lib/events'
import { getMe, login as loginRequest, logout as logoutRequest } from './api/authApi'
import { AuthContext, type AuthContextValue, type AuthStatus, type LoginResult } from './AuthContext'
import { rememberReturnPath } from './lib/authReturnPath'
import { loginErrorMessage } from './lib/loginErrors'

const FOCUS_REFRESH_INTERVAL_MS = 30_000
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 30_000]
const UNAUTHORIZED = 401

type Session = { status: AuthStatus; me: StaffMe | null; permissions: MyPermissions | null; reconnecting: boolean }

const LOADING: Session = { status: 'loading', me: null, permissions: null, reconnecting: false }
const RECONNECTING: Session = { status: 'loading', me: null, permissions: null, reconnecting: true }
const ANONYMOUS: Session = { status: 'anonymous', me: null, permissions: null, reconnecting: false }

type Fetched = { kind: 'session'; me: StaffMe; permissions: MyPermissions } | { kind: 'anonymous' } | { kind: 'unavailable' }

async function loadPermissions(): Promise<MyPermissions | null> {
  try {
    const { data } = await getMyPermissions()
    return data ?? null
  } catch {
    return null
  }
}

async function fetchSession(): Promise<Fetched> {
  try {
    const me = await getMe()
    if (!me.data) return me.response.status === UNAUTHORIZED ? { kind: 'anonymous' } : { kind: 'unavailable' }
    const permissions = await loadPermissions()
    return permissions ? { kind: 'session', me: me.data, permissions } : { kind: 'unavailable' }
  } catch {
    return { kind: 'unavailable' }
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const location = useLocation()
  const [session, setSession] = useState<Session>(LOADING)
  const [attempt, setAttempt] = useState<number | null>(0)
  const lastRefresh = useRef(0)
  const generation = useRef(0)

  const loadSession = useCallback(async () => {
    generation.current += 1
    const run = generation.current
    const next = await fetchSession()
    if (run !== generation.current) return
    if (next.kind === 'unavailable') {
      setSession((current) => (current.status === 'authenticated' ? current : RECONNECTING))
      setAttempt((current) => (current ?? 0) + 1)
      return
    }
    lastRefresh.current = Date.now()
    setAttempt(null)
    if (next.kind === 'anonymous') {
      forgetCsrf()
      setSession(ANONYMOUS)
      return
    }
    setSession({ status: 'authenticated', me: next.me, permissions: next.permissions, reconnecting: false })
  }, [])

  useEffect(() => {
    if (attempt === null) return undefined
    const delay = attempt === 0 ? 0 : RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length) - 1]
    const timer = window.setTimeout(() => void loadSession(), delay)
    return () => window.clearTimeout(timer)
  }, [attempt, loadSession])

  const onUnauthorized = useEffectEvent(() => {
    if (session.status !== 'authenticated') return
    generation.current += 1
    rememberReturnPath(location)
    forgetCsrf()
    setAttempt(null)
    setSession(ANONYMOUS)
  })

  const onRefreshRequest = useEffectEvent((force: boolean) => {
    if (session.status !== 'authenticated') return
    if (!force && Date.now() - lastRefresh.current < FOCUS_REFRESH_INTERVAL_MS) return
    void loadSession()
  })

  useEffect(() => {
    const offUnauthorized = onConsoleEvent('unauthorized', () => onUnauthorized())
    const offPermissions = onConsoleEvent('permissions-changed', () => onRefreshRequest(true))
    const onFocus = () => onRefreshRequest(false)
    window.addEventListener('focus', onFocus)
    return () => {
      offUnauthorized()
      offPermissions()
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const login = useCallback(async (email: string, password: string, twoFactorCode?: string): Promise<LoginResult> => {
    try {
      const { data, error, response } = await loginRequest({ email, password, twoFactorCode: twoFactorCode || null })
      if (!data) {
        const problem = error as Problem | undefined
        const twoFactor = problem?.code === 'auth.two_factor_required' ? 'required' : problem?.code === 'auth.invalid_two_factor_code' ? 'invalid' : undefined
        return { ok: false, message: loginErrorMessage(response.status, problem), twoFactor }
      }
      forgetCsrf()
      generation.current += 1
      const run = generation.current
      const permissions = await loadPermissions()
      if (run !== generation.current) return { ok: true }
      if (permissions) {
        lastRefresh.current = Date.now()
        setAttempt(null)
        setSession({ status: 'authenticated', me: data, permissions, reconnecting: false })
      } else {
        setSession(RECONNECTING)
        setAttempt((current) => (current ?? 0) + 1)
      }
      return { ok: true }
    } catch {
      return { ok: false, message: "Немає зв'язку з сервером. Спробуйте ще раз." }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      const result = await withCsrf((headers) => logoutRequest(headers))
      if (!result.response.ok && result.response.status !== UNAUTHORIZED) return false
    } catch {
      return false
    }
    generation.current += 1
    forgetCsrf()
    setAttempt(null)
    setSession(ANONYMOUS)
    return true
  }, [])

  const permissions = session.permissions
  const hasPermission = useCallback((permissionKey: string) => checkPermission(permissionKey, permissions), [permissions])

  const value = useMemo<AuthContextValue>(
    () => ({
      status: session.status,
      isAuthenticated: session.status === 'authenticated',
      isLoading: session.status === 'loading',
      reconnecting: session.reconnecting,
      me: session.me,
      permissions,
      hasPermission,
      login,
      logout,
      refresh: loadSession,
    }),
    [hasPermission, loadSession, login, logout, permissions, session.me, session.reconnecting, session.status],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
