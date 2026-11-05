import { Button, Select, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { createRole, updateRole, type PermissionDefinition, type StaffRole } from '@/shared/auth/permissionsApi'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'
import { permissionNames, problemKeys } from '../lib/permissionTree'
import { extraFieldMessages, NETWORK_FAILURE, toFailure, type Failure } from '../lib/problems'
import { rightsText, sortRoles } from '../lib/roleText'
import { FailureAlert } from './FailureAlert'

const NAME_MIN = 2
const NAME_MAX = 60
const DESCRIPTION_MAX = 300

type RoleFormModalProps = {
  role: StaffRole | null
  roles: readonly StaffRole[]
  catalog: readonly PermissionDefinition[]
  onClose: () => void
  onSaved: (role: StaffRole, created: boolean) => void
}

export function RoleFormModal({ role, roles, catalog, onClose, onSaved }: RoleFormModalProps) {
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [copyFrom, setCopyFrom] = useState<string | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [busy, setBusy] = useState(false)
  const errors = failure?.fields ?? {}
  const copyOptions = sortRoles(roles).map((item) => ({
    value: item.id,
    label: `${item.name} — ${item.isSuperuser ? 'усі права' : rightsText(item.permissionCount)}`,
  }))

  function close() {
    if (!busy) onClose()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
      setFailure({ title: '', fields: { name: `Назва ролі від ${NAME_MIN} до ${NAME_MAX} символів.` } })
      return
    }
    setBusy(true)
    setFailure(null)
    const body = { name: trimmed, description: description.trim() || null, copyFromRoleId: role ? null : copyFrom }
    try {
      const result = role ? await withCsrf((headers) => updateRole(headers, role.id, body)) : await withCsrf((headers) => createRole(headers, body))
      if (result.data) {
        setBusy(false)
        onSaved(result.data, !role)
        return
      }
      setFailure(toFailure(result.error, role ? 'Роль не збережено.' : 'Роль не створено.'))
    } catch {
      setFailure(NETWORK_FAILURE)
    }
    setBusy(false)
  }

  const escalation = failure?.code === 'roles.escalation' ? { ...failure, detail: undefined } : null
  const missing = escalation ? permissionNames(problemKeys(escalation.problem, 'missingKeys'), catalog) : ''

  return (
    <AppModal opened title={role ? `Роль «${role.name}»` : 'Нова роль'} onClose={close} closeOnClickOutside={!busy}>
      <form noValidate onSubmit={submit} aria-label={role ? 'Змінити роль' : 'Нова роль'}>
        <Stack gap="sm">
          <TextInput
            label="Назва"
            required
            maxLength={NAME_MAX}
            value={name}
            error={errors.name || undefined}
            onChange={(event) => {
              setName(event.currentTarget.value)
              setFailure(null)
            }}
            data-autofocus
          />
          <Textarea
            label="Опис"
            description="Для кого роль і що вона дозволяє. Видно в списку ролей."
            autosize
            minRows={2}
            maxRows={5}
            maxLength={DESCRIPTION_MAX}
            value={description}
            error={errors.description || undefined}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
          {role ? null : (
            <Select
              label="Скопіювати права з"
              placeholder="Без прав — налаштуєте після створення"
              data={copyOptions}
              value={copyFrom}
              clearable
              error={errors.copyFromRoleId || undefined}
              onChange={setCopyFrom}
            />
          )}
          {escalation ? (
            <FailureAlert failure={escalation}>
              <Text size="sm">Ваша роль не має прав: {missing}. Оберіть іншу роль для копіювання або створіть роль без прав.</Text>
            </FailureAlert>
          ) : (
            <FailureAlert failure={failure} extra={extraFieldMessages(failure, ['name', 'description', 'copyFromRoleId'])} />
          )}
        </Stack>
        <AppModalFooter>
          <Button variant="default" disabled={busy} onClick={close}>
            Скасувати
          </Button>
          <Button type="submit" loading={busy}>
            {role ? 'Зберегти' : 'Створити роль'}
          </Button>
        </AppModalFooter>
      </form>
    </AppModal>
  )
}
