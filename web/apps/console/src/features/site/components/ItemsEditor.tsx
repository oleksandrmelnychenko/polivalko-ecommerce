import { ActionIcon, Button, Textarea, TextInput, Tooltip } from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { LIMITS, moveItem, newItemRow, type ItemRow } from '../lib/homeSettings'
import { fieldError, type FieldErrors } from '../lib/useSaveForm'
import { MoveButtons } from './MoveButtons'

type ItemsEditorProps = {
  name: 'perks' | 'steps'
  noun: string
  items: ItemRow[]
  max: number
  errors: FieldErrors
  onChange: (items: ItemRow[]) => void
  onClearField: (...path: (string | number)[]) => void
}

export function ItemsEditor({ name, noun, items, max, errors, onChange, onClearField }: ItemsEditorProps) {
  function update(index: number, patch: Partial<ItemRow>) {
    onChange(items.map((item, position) => (position === index ? { ...item, ...patch } : item)))
  }

  return (
    <div className="site-items">
      {items.length === 0 ? <p className="site-muted">Пунктів немає: блок на сайті буде порожнім. Додайте пункт або вимкніть блок вище.</p> : null}
      <ol className="site-item-list">
        {items.map((item, index) => {
          const label = item.title.trim() || `${noun} ${index + 1}`
          return (
            <li key={item.id} className="site-item">
              <span className="site-item-index" aria-hidden="true">
                {index + 1}
              </span>
              <div className="site-item-fields">
                <TextInput
                  label="Заголовок"
                  value={item.title}
                  maxLength={LIMITS.itemTitle}
                  required
                  error={fieldError(errors, name, index, 'title')}
                  onChange={(event) => {
                    update(index, { title: event.currentTarget.value })
                    onClearField(name, index, 'title')
                  }}
                />
                <Textarea
                  label="Текст"
                  value={item.text}
                  maxLength={LIMITS.itemText}
                  autosize
                  minRows={2}
                  error={fieldError(errors, name, index, 'text')}
                  onChange={(event) => {
                    update(index, { text: event.currentTarget.value })
                    onClearField(name, index, 'text')
                  }}
                />
              </div>
              <div className="site-item-actions">
                <MoveButtons index={index} count={items.length} label={label} onMove={(delta) => onChange(moveItem(items, index, delta))} />
                <Tooltip label="Видалити">
                  <ActionIcon variant="subtle" color="red" aria-label={`Видалити: ${label}`} onClick={() => onChange(items.filter((_, position) => position !== index))}>
                    <IconTrash size={16} stroke={1.7} />
                  </ActionIcon>
                </Tooltip>
              </div>
            </li>
          )
        })}
      </ol>
      <Button
        variant="default"
        size="sm"
        leftSection={<IconPlus size={16} stroke={1.8} />}
        disabled={items.length >= max}
        onClick={() => onChange([...items, newItemRow()])}
      >
        Додати пункт
      </Button>
      {items.length >= max ? <span className="site-muted site-items-limit">Не більше {max} пунктів.</span> : null}
    </div>
  )
}
