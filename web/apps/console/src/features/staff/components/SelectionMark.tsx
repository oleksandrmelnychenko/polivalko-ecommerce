import { IconCheck, IconMinus } from '@tabler/icons-react'
import type { MouseEvent } from 'react'

type SelectionMarkProps = {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  label?: string
  labelledBy?: string
  describedBy?: string
  size?: 'md' | 'sm'
  onChange: () => void
}

export function SelectionMark({ checked, indeterminate = false, disabled = false, label, labelledBy, describedBy, size = 'md', onChange }: SelectionMarkProps) {
  function onClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    onChange()
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={`roles-check${checked ? ' is-checked' : ''}${indeterminate ? ' is-mixed' : ''}${size === 'sm' ? ' is-sm' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {indeterminate ? <IconMinus size={12} stroke={2.6} /> : checked ? <IconCheck size={12} stroke={2.6} /> : null}
    </button>
  )
}
