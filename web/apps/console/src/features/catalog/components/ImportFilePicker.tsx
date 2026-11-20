import { ActionIcon } from '@mantine/core'
import { IconFileCheck, IconUpload, IconX } from '@tabler/icons-react'
import { useId, useRef, useState, type DragEvent } from 'react'

type Props = {
  label: string
  hint: string
  accept: string
  file: File | null
  disabled: boolean
  onChange: (file: File | null) => void
}

export function ImportFilePicker({ label, hint, accept, file, disabled, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [dragging, setDragging] = useState(false)
  const [multiple, setMultiple] = useState(false)

  function drop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    const files = event.dataTransfer.files
    setMultiple(files.length > 1)
    if (files.length > 0) onChange(files.length === 1 ? files[0] : null)
  }

  return (
    <div className="import-picker" data-dragging={dragging && !disabled || undefined}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'
        setDragging(true)
      }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
      onDrop={drop}>
      <input type="file" hidden ref={input} accept={accept} disabled={disabled} onChange={event => {
        const next = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (next) { setMultiple(false); onChange(next) }
      }} />
      <button type="button" className="import-picker-button" aria-label={label} aria-describedby={hintId}
        disabled={disabled} onClick={() => input.current?.click()}>
        {file ? <IconFileCheck size={23} /> : <IconUpload size={23} />}
        <strong>{file?.name ?? 'Оберіть або перетягніть файл'}</strong>
        <span id={hintId}>{hint}</span>
      </button>
      {file && <ActionIcon className="import-clear" variant="default" radius="xl" aria-label="Прибрати файл"
        disabled={disabled} onClick={() => { setMultiple(false); onChange(null) }}><IconX size={14} /></ActionIcon>}
      {multiple && <small role="alert">Оберіть один файл для імпорту.</small>}
    </div>
  )
}
