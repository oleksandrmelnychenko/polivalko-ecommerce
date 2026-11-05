import type { ReactNode } from 'react'
import type { PermissionKey } from '@/shared/auth/permissionKeys'
import { PageState } from '@/shared/ui/PageState'
import { usePermissions } from '../usePermissions'
import { AccessDenied } from './AccessDenied'

type PagePermissionBoundaryProps = {
  permissionKey: PermissionKey
  children: ReactNode
  homePath?: string
}

export function PagePermissionBoundary({ permissionKey, children, homePath }: PagePermissionBoundaryProps) {
  const { can, isLoading } = usePermissions()
  if (isLoading) return <PageState kind="loading" />
  if (!can(permissionKey)) return <AccessDenied permissionKey={permissionKey} homePath={homePath} />
  return children
}
