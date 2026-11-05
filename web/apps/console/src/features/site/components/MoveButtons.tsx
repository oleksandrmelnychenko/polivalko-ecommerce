import { ActionIcon, Tooltip } from '@mantine/core'
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react'

type MoveButtonsProps = {
  index: number
  count: number
  label: string
  disabled?: boolean
  onMove: (delta: number) => void
}

export function MoveButtons({ index, count, label, disabled = false, onMove }: MoveButtonsProps) {
  return (
    <div className="site-move">
      <Tooltip label="Вище">
        <ActionIcon variant="default" aria-label={`Вище: ${label}`} disabled={disabled || index === 0} onClick={() => onMove(-1)}>
          <IconArrowUp size={16} stroke={1.7} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Нижче">
        <ActionIcon variant="default" aria-label={`Нижче: ${label}`} disabled={disabled || index >= count - 1} onClick={() => onMove(1)}>
          <IconArrowDown size={16} stroke={1.7} />
        </ActionIcon>
      </Tooltip>
    </div>
  )
}
