import { TableChip } from '@/shared/ui/TableChip'
import './account-chips.css'

type AccountChipsProps = {
  emailConfirmed: boolean
  lockedOut: boolean
  blocked?: boolean
  size?: 'md' | 'lg'
}

export function AccountChips({ emailConfirmed, lockedOut, blocked, size }: AccountChipsProps) {
  const lock =
    blocked === undefined
      ? lockedOut
        ? { tone: 'danger' as const, label: 'Вхід заблоковано' }
        : null
      : blocked
        ? { tone: 'danger' as const, label: 'Кабінет заблоковано' }
        : lockedOut
          ? { tone: 'warning' as const, label: 'Тимчасово заблоковано після невдалих входів' }
          : null

  return (
    <span className="customers-chips">
      {lock ? <TableChip dot size={size} tone={lock.tone} value={lock.label} /> : null}
      <TableChip size={size} tone={emailConfirmed ? 'success' : 'warning'} value={emailConfirmed ? 'Пошта підтверджена' : 'Пошта не підтверджена'} />
    </span>
  )
}
