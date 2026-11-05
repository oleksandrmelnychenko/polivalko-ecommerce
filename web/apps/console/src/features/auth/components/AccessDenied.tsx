import { Button } from '@mantine/core'
import { Link } from 'react-router-dom'
import { PERMISSION_LABELS, type PermissionKey } from '@/shared/auth/permissionKeys'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { usePermissions } from '../usePermissions'

export function AccessDenied({ permissionKey, homePath = '/' }: { permissionKey?: PermissionKey; homePath?: string }) {
  const { roleName } = usePermissions()
  const right = permissionKey ? `«${PERMISSION_LABELS[permissionKey]}»` : 'для цього розділу'
  const role = roleName ? `Ролі «${roleName}»` : 'Вашій ролі'

  return (
    <>
      <PageHeader title="Недостатньо прав" />
      <PageState
        kind="forbidden"
        title="Недостатньо прав"
        description={`${role} не надано право ${right}. Якщо воно потрібне для роботи, зверніться до працівника з роллю «Адміністратор».`}
        action={
          <Button component={Link} to={homePath} variant="default" size="sm">
            На головну
          </Button>
        }
      />
    </>
  )
}
