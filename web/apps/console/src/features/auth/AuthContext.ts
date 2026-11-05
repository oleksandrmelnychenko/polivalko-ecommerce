import { createContext } from 'react'
import type { MyPermissions, StaffMe } from '@/shared/auth/permissionsApi'

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

export type LoginResult = { ok: true } | { ok: false; message: string }

export type AuthContextValue = {
  status: AuthStatus
  isAuthenticated: boolean
  isLoading: boolean
  me: StaffMe | null
  permissions: MyPermissions | null
  hasPermission: (permissionKey: string) => boolean
  login: (email: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
