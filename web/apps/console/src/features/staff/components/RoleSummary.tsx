import { Button, Tooltip } from '@mantine/core'
import { IconPencil, IconTrash } from '@tabler/icons-react'
import type { StaffRole } from '@/shared/auth/permissionsApi'
import { TableChip } from '@/shared/ui/TableChip'
import { countText, updatedText, usersText } from '../lib/roleText'

type RoleSummaryProps = {
  role: StaffRole
  selectedCount: number
  totalCount: number
  stamp: { updatedAt: string | null; updatedBy: string | null }
  busy: boolean
  onEdit: () => void
  onDelete: () => void
}

export function RoleSummary({ role, selectedCount, totalCount, stamp, busy, onEdit, onDelete }: RoleSummaryProps) {
  const updated = updatedText(stamp.updatedAt, stamp.updatedBy)
  const editHint = role.isSuperuser ? 'Роль адміністратора змінити не можна' : null
  const deleteHint = role.isSystem ? 'Системну роль не можна видалити' : null

  return (
    <div className="roles-summary">
      <div className="roles-summary-main">
        <div className="roles-summary-title">
          <h2>{role.name}</h2>
          {role.isSystem ? <TableChip value="Системна" /> : null}
          {role.isSuperuser ? <TableChip tone="document" value="Повний доступ" /> : null}
        </div>
        {role.description ? <p className="roles-summary-description">{role.description}</p> : null}
        <p className="roles-summary-meta">
          <span>{usersText(role.userCount)}</span>
          <span>
            Права: {countText.format(selectedCount)} з {countText.format(totalCount)}
          </span>
          <span>{updated ?? 'Ще не змінювалась'}</span>
        </p>
      </div>
      <div className="roles-summary-actions">
        <Tooltip label={editHint} disabled={!editHint}>
          <span>
            <Button variant="default" size="sm" leftSection={<IconPencil size={15} stroke={1.8} />} disabled={Boolean(editHint) || busy} onClick={onEdit}>
              Змінити
            </Button>
          </span>
        </Tooltip>
        <Tooltip label={deleteHint} disabled={!deleteHint}>
          <span>
            <Button variant="default" color="red" size="sm" leftSection={<IconTrash size={15} stroke={1.8} />} disabled={Boolean(deleteHint) || busy} onClick={onDelete}>
              Видалити
            </Button>
          </span>
        </Tooltip>
      </div>
    </div>
  )
}
