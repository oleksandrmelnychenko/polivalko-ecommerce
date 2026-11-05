import type { MyPermissions } from './permissionsApi'

export function hasPermission(permissionKey: string, permissions: MyPermissions | null): boolean {
  if (!permissions) return false
  if (permissions.isSuperuser) return true
  return permissions.permissionKeys.includes(permissionKey)
}
