import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'

export function useWorkFormAccess() {
  const { can, isLoading } = usePermissions()
  const access = PermissionKeys.DnTradeArchive
  return { allowed: can(access.View) && can(access.Import) && can(access.Original), isLoading }
}
