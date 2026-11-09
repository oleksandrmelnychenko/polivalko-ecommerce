import { Alert, Button, Group, Text } from '@mantine/core'
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react'
import type { PermissionDefinition } from '@/shared/auth/permissionsApi'
import { permissionNames, problemKeys } from '../lib/permissionTree'
import type { Failure } from '../lib/problems'

type SaveFailureAlertProps = {
  failure: Failure
  catalog: readonly PermissionDefinition[]
  onReload: () => void
}

export function SaveFailureAlert({ failure, catalog, onReload }: SaveFailureAlertProps) {
  if (failure.code === 'roles.version_conflict') {
    const version = failure.problem?.currentVersion
    return (
      <Alert color="yellow" variant="light" icon={<IconAlertCircle size={18} />} title="Права ролі вже змінив інший працівник" role="alert">
        <Group justify="space-between" gap="xs" align="center">
          <Text size="sm">
            Ваші зміни не збережено. Завантажте актуальні права й внесіть зміни ще раз.
            {typeof version === 'number' ? ` Актуальна версія: ${version}.` : ''}
          </Text>
          <Button size="xs" variant="default" leftSection={<IconRefresh size={14} />} onClick={onReload}>
            Завантажити актуальні права
          </Button>
        </Group>
      </Alert>
    )
  }

  if (failure.code === 'roles.unknown_permissions') {
    const keys = problemKeys(failure.problem, 'unknownKeys')
    return (
      <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title={failure.title} role="alert">
        <Group justify="space-between" gap="xs" align="center">
          <Text size="sm">
            Сервер не знає таких прав: {keys.join(', ')}. Каталог прав оновився. Завантажте його й внесіть зміни ще раз.
          </Text>
          <Button size="xs" variant="default" leftSection={<IconRefresh size={14} />} onClick={onReload}>
            Оновити каталог
          </Button>
        </Group>
      </Alert>
    )
  }

  if (failure.code === 'roles.escalation') {
    return (
      <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title={failure.title} role="alert">
        <Text size="sm">
          Вашій ролі бракує прав: {permissionNames(problemKeys(failure.problem, 'missingKeys'), catalog)}. Зніміть їх або попросіть працівника з роллю «Адміністратор» внести ці зміни.
        </Text>
      </Alert>
    )
  }

  return (
    <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} title={failure.title} role="alert">
      {failure.detail ? <Text size="sm">{failure.detail}</Text> : null}
    </Alert>
  )
}
