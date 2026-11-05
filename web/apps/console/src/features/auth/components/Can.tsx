import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import type { PermissionKey } from '@/shared/auth/permissionKeys'
import { usePermissions } from '../usePermissions'

type CanProps = {
  permission: PermissionKey
  children: ReactNode
  fallback?: ReactNode
  mode?: 'hide' | 'disable'
  deniedReason?: string
}

export function Can({ permission, children, fallback = null, mode = 'hide', deniedReason = 'Недостатньо прав для цієї дії' }: CanProps) {
  const { can } = usePermissions()
  if (can(permission)) return children
  if (mode === 'hide' || !isValidElement(children)) return fallback
  const child = children as ReactElement<Record<string, unknown>>
  return cloneElement(child, { 'aria-disabled': true, disabled: true, title: deniedReason })
}

export function PermissionGate({ permissionKey, children, fallback = null }: { permissionKey: PermissionKey; children: ReactNode; fallback?: ReactNode }) {
  return (
    <Can fallback={fallback} permission={permissionKey}>
      {children}
    </Can>
  )
}
