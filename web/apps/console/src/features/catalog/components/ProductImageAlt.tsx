import { TextInput } from '@mantine/core'
import { useState } from 'react'

type ProductImageAltProps = {
  id: string
  value: string
  disabled: boolean
  onSave: (alt: string) => void
}

export function ProductImageAlt({ id, value, disabled, onSave }: ProductImageAltProps) {
  const [text, setText] = useState(value)

  function commit() {
    const next = text.trim()
    if (next && next !== value) onSave(next)
  }

  return (
    <TextInput
      id={`alt-${id}`}
      size="xs"
      aria-label="Опис фото"
      placeholder="Що на фото"
      value={text}
      maxLength={300}
      disabled={disabled}
      onChange={(event) => setText(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
    />
  )
}
