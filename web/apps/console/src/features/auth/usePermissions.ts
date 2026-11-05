import { useCallback } from 'react'
import type { PermissionKey } from '@/shared/auth/permissionKeys'
import { useAuth } from './useAuth'

export function usePermissions() {
  const { hasPermission, isLoading, permissions } = useAuth()
  const can = useCallback((permission: PermissionKey) => hasPermission(permission), [hasPermission])
  const cannot = useCallback((permission: PermissionKey) => !hasPermission(permission), [hasPermission])
  const canAny = useCallback((keys: readonly PermissionKey[]) => keys.some((key) => hasPermission(key)), [hasPermission])

  return {
    can,
    cannot,
    canAny,
    isLoading,
    isSuperuser: Boolean(permissions?.isSuperuser),
    roleName: permissions?.roleName ?? null,
    permissionKeys: permissions?.permissionKeys ?? [],
  }
}
