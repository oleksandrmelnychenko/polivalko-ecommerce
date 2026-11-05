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

type Session = { status: AuthStatus; me: StaffMe | null; permissions: MyPermissions | null }

const LOADING: Session = { status: 'loading', me: null, permissions: null }
const ANONYMOUS: Session = { status: 'anonymous', me: null, permissions: null }

async function fetchSession(): Promise<Session> {
  try {
    const me = await getMe()
    if (!me.data) return ANONYMOUS
    return { status: 'authenticated', me: me.data, permissions: await loadPermissions() }
  } catch {
    return ANONYMOUS
  }
}

async function loadPermissions(): Promise<MyPermissions | null> {
  try {
    const { data } = await getMyPermissions()
    return data ?? null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const location = useLocation()
  const [session, setSession] = useState<Session>(LOADING)
  const lastRefresh = useRef(0)

  const loadSession = useCallback(async () => {
    const next = await fetchSession()
    lastRefresh.current = Date.now()
    setSession(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchSession().then((next) => {
      if (cancelled) return
      lastRefresh.current = Date.now()
      setSession(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const onUnauthorized = useEffectEvent(() => {
    if (session.status !== 'authenticated') return
    rememberReturnPath(location)
    forgetCsrf()
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

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const { data, error, response } = await loginRequest({ email, password })
      if (!data) return { ok: false, message: loginErrorMessage(response.status, error as Problem | undefined) }
      forgetCsrf()
      const permissions = await loadPermissions()
      lastRefresh.current = Date.now()
      setSession({ status: 'authenticated', me: data, permissions })
      return { ok: true }
    } catch {
      return { ok: false, message: "Немає зв'язку з сервером. Спробуйте ще раз." }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await withCsrf((headers) => logoutRequest(headers))
    } catch {
      forgetCsrf()
    }
    forgetCsrf()
    setSession(ANONYMOUS)
  }, [])

  const permissions = session.permissions
  const hasPermission = useCallback((permissionKey: string) => checkPermission(permissionKey, permissions), [permissions])

  const value = useMemo<AuthContextValue>(
    () => ({
      status: session.status,
      isAuthenticated: session.status === 'authenticated',
      isLoading: session.status === 'loading',
      me: session.me,
      permissions,
      hasPermission,
      login,
      logout,
      refresh: loadSession,
    }),
    [hasPermission, loadSession, login, logout, permissions, session.me, session.status],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
