import { Button, Stack, Text } from '@mantine/core'
import { IconTrash, IconUsers } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { withCsrf } from '@/shared/api/csrf'
import { deleteRole, type StaffRole } from '@/shared/auth/permissionsApi'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'
import { NETWORK_FAILURE, toFailure, type Failure } from '../lib/problems'
import { usersText } from '../lib/roleText'
import { FailureAlert } from './FailureAlert'

type DeleteRoleDialogProps = {
  role: StaffRole
  canOpenStaff: boolean
  onClose: () => void
  onDeleted: (role: StaffRole) => void
  onStale: () => void
}

export function DeleteRoleDialog({ role, canOpenStaff, onClose, onDeleted, onStale }: DeleteRoleDialogProps) {
  const [failure, setFailure] = useState<Failure | null>(null)
  const [busy, setBusy] = useState(false)
  const inUseCount = failure?.code === 'roles.in_use' ? Number(failure.problem?.userCount ?? role.userCount) : role.userCount
  const inUse = inUseCount > 0

  function close() {
    if (!busy) onClose()
  }

  async function confirm() {
    setBusy(true)
    setFailure(null)
    try {
      const result = await withCsrf((headers) => deleteRole(headers, role.id))
      if (result.response.ok) {
        setBusy(false)
        onDeleted(role)
        return
      }
      const next = toFailure(result.error, 'Роль не видалено.')
      setFailure(next)
      if (next.code === 'roles.in_use' || next.code === 'roles.system') onStale()
    } catch {
      setFailure(NETWORK_FAILURE)
    }
    setBusy(false)
  }

  return (
    <AppModal opened title="Видалити роль" size={460} onClose={close} closeOnClickOutside={!busy}>
      <Stack gap="sm">
        {inUse ? (
          <Text size="sm">
            Роль «{role.name}» призначено: {usersText(inUseCount)}. Спершу змініть їм роль на сторінці «Працівники», потім видаліть роль.
          </Text>
        ) : (
          <Text size="sm">Видалити роль «{role.name}»? Права ролі зникнуть разом із нею. Скасувати видалення не можна.</Text>
        )}
        <FailureAlert failure={failure} />
      </Stack>
      <AppModalFooter>
        <Button variant="default" disabled={busy} onClick={close}>
          {inUse ? 'Закрити' : 'Скасувати'}
        </Button>
        {inUse ? (
          canOpenStaff ? (
            <Button component={Link} to={`/system/staff?role=${encodeURIComponent(role.id)}`} leftSection={<IconUsers size={16} stroke={1.8} />}>
              Відкрити працівників
            </Button>
          ) : null
        ) : (
          <Button color="red" loading={busy} leftSection={<IconTrash size={16} stroke={1.8} />} onClick={() => void confirm()} data-autofocus>
            Видалити роль
          </Button>
        )}
      </AppModalFooter>
    </AppModal>
  )
}
