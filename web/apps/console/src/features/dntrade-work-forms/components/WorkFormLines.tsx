import { ActionIcon, Button, Fieldset, Group, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import type { WorkFormLine } from '../api/workFormsApi'
import { WORK_LINE_FIELDS, workFormFields, workLineFieldLabel, type WorkLineField } from '../lib/workFormFields'
import { WORK_FORM_TYPES, type WorkFormType } from '../lib/workForms'

export const MAX_WORK_FORM_LINES = 100

export type WorkFormEditorLine = { key: string; value: WorkFormLine }

type WorkFormLinesProps = {
  type: WorkFormType
  lines: WorkFormEditorLine[]
  errors: Record<string, string>
  disabled?: boolean
  forReview: boolean
  onAdd: () => void
  onChange: (key: string, field: WorkLineField, value: string) => void
  onRemove: (key: string) => void
}

export function WorkFormLines({ type, lines, errors, disabled, forReview, onAdd, onChange, onRemove }: WorkFormLinesProps) {
  const fields = workFormFields(type).lines
  if (!fields.length) return null

  return (
    <Fieldset legend="Товарні рядки" className="dntrade-work-form-group" disabled={disabled}>
      <Stack gap="sm">
        {lines.map(({ key, value }, index) => (
          <div className="dntrade-work-form-line" key={key} role="group" aria-label={`Рядок ${index + 1}`}>
            <Group mb={8} justify="space-between">
              <Text size="sm" fw={600}>Товар {index + 1}</Text>
              <ActionIcon type="button" color="red" variant="subtle" aria-label={`Видалити рядок ${index + 1}`} onClick={() => onRemove(key)}>
                <IconTrash size={16} stroke={1.7} />
              </ActionIcon>
            </Group>
            <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="sm">
              {fields.map((field) => {
                const config = WORK_LINE_FIELDS[field]
                const props = {
                  label: workLineFieldLabel(field, type),
                  value: value[field] ?? '',
                  maxLength: config.maxLength,
                  required: forReview && (field === 'quantity' || (field === 'unitPrice' && WORK_FORM_TYPES[type].section === 'sales')),
                  error: errors[`data.lines[${index}].${field}`],
                  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(key, field, event.currentTarget.value),
                }
                return field === 'description' ? (
                  <Textarea key={field} {...props} autosize minRows={1} maxRows={3} />
                ) : (
                  <TextInput key={field} {...props} inputMode={config.format === 'decimal' ? 'decimal' : undefined} />
                )
              })}
            </SimpleGrid>
          </div>
        ))}
        {errors['data.lines'] ? <Text size="sm" c="red" role="alert">{errors['data.lines']}</Text> : null}
        <Group justify="space-between">
          <Button type="button" variant="default" size="sm" leftSection={<IconPlus size={16} />} disabled={lines.length >= MAX_WORK_FORM_LINES} onClick={onAdd}>
            Додати товар
          </Button>
          {lines.length ? <Text size="xs" c="dimmed">{lines.length} з {MAX_WORK_FORM_LINES} рядків</Text> : null}
        </Group>
      </Stack>
    </Fieldset>
  )
}
