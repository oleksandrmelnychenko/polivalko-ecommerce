import { CloseButton, TextInput } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconSearch } from '@tabler/icons-react'
import { useState } from 'react'

type ListSearchProps = {
  value: string
  placeholder: string
  onChange: (value: string) => void
}

export function ListSearch({ value, placeholder, onChange }: ListSearchProps) {
  const [text, setText] = useState(value)
  const [seen, setSeen] = useState(value)
  const commit = useDebouncedCallback((next: string) => onChange(next), 250)

  if (seen !== value) {
    setSeen(value)
    if (value.trim() !== text.trim()) setText(value)
  }

  function change(next: string) {
    setText(next)
    commit(next)
  }

  return (
    <TextInput
      className="app-filter-wide"
      label="Пошук"
      placeholder={placeholder}
      value={text}
      leftSection={<IconSearch size={16} stroke={1.7} />}
      rightSection={text ? <CloseButton size="sm" aria-label="Очистити пошук" onClick={() => change('')} /> : null}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => change(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit.flush()
      }}
    />
  )
}
