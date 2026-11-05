import { ActionIcon, Kbd, UnstyledButton } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { openSearchPalette } from '@/shared/lib/events'

export function SearchButton() {
  return (
    <>
      <UnstyledButton className="console-search-button" onClick={openSearchPalette} aria-label="Пошук (Ctrl K)">
        <IconSearch size={16} stroke={1.8} aria-hidden="true" />
        <span className="console-search-button-label">Пошук</span>
        <Kbd size="xs" className="console-search-button-kbd">
          Ctrl K
        </Kbd>
      </UnstyledButton>
      <ActionIcon className="console-search-icon" variant="subtle" color="gray" size={36} onClick={openSearchPalette} aria-label="Пошук">
        <IconSearch size={18} stroke={1.8} />
      </ActionIcon>
    </>
  )
}
