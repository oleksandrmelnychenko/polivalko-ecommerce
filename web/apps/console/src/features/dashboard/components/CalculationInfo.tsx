import { ActionIcon, Popover } from '@mantine/core'
import { IconInfoCircle, IconX } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'

export function CalculationInfo({ title, children }: { title: string; children: ReactNode }) {
  const [opened, setOpened] = useState(false)
  return <Popover opened={opened} onChange={setOpened} width={460} radius="lg" shadow="md" trapFocus returnFocus>
    <Popover.Target>
      <ActionIcon variant="subtle" color="gray" radius="xl" size="sm" aria-label={title} onClick={() => setOpened(!opened)}>
        <IconInfoCircle size={18} aria-hidden="true" />
      </ActionIcon>
    </Popover.Target>
    <Popover.Dropdown className="dash-calculation-info">
      <header><strong>{title}</strong>
        <ActionIcon variant="subtle" color="gray" radius="xl" size="sm" aria-label="Закрити підказку" onClick={() => setOpened(false)}>
          <IconX size={16} aria-hidden="true" />
        </ActionIcon>
      </header>
      <div className="dash-calculation-text" tabIndex={0}>{children}</div>
    </Popover.Dropdown>
  </Popover>
}
