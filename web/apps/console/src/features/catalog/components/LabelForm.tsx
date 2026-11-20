import { Alert, NumberInput, Stack, Switch, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconEye, IconPalette } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useReportDirty } from '@/shared/lib/useReportDirty'
import { saveLabel, type LabelTone, type ProductLabel } from '../api/dictionariesApi'
import { DEFAULT_NEW_DAYS, isAutoLabel, LABEL_TONES } from '../lib/labels'
import { CatalogSectionTitle } from './CatalogSectionTitle'
import { LabelChip } from './LabelChip'

type LabelFormProps = {
  formId: string
  label: ProductLabel | null
  nextSortOrder: number
  error: string | null
  onBusy: (busy: boolean) => void
  onSaved: (label?: ProductLabel) => void
  onDirty?: (dirty: boolean) => void
}

type Fields = { name: string; tone: LabelTone; newDays: number | string; sortOrder: number | string; isActive: boolean }

const AUTO_HELP = {
  sale: 'Мітка діє автоматично, поки поточна ціна нижча за попередню.',
  new: 'Відлік починається з першої появи товару в каталозі.',
} as const

export function LabelForm({ formId, label, nextSortOrder, error, onBusy, onSaved, onDirty }: LabelFormProps) {
  const auto = label !== null && isAutoLabel(label)
  const [fields, setFields] = useState<Fields>(() => ({
    name: label?.name ?? '',
    tone: label?.tone ?? 'green',
    newDays: label?.newDays ?? DEFAULT_NEW_DAYS,
    sortOrder: label?.sortOrder ?? nextSortOrder,
    isActive: label?.isActive ?? true,
  }))
  const [pristine] = useState(() => JSON.stringify(fields))
  useReportDirty(JSON.stringify(fields) !== pristine, onDirty)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const kind = label?.kind ?? 'manual'

  function set<K extends keyof Fields>(name: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!fields.name.trim()) {
      setErrors({ name: 'Вкажіть текст мітки.' })
      return
    }
    const days = Number(fields.newDays)
    if (kind === 'new' && (!Number.isInteger(days) || days < 1 || days > 365)) {
      setErrors({ newDays: 'Вкажіть від 1 до 365 днів.' })
      return
    }
    setBusy(true)
    onBusy(true)
    setFormError(null)
    try {
      const result = await withCsrf((headers) =>
        saveLabel(headers, label?.id ?? null, {
          name: fields.name.trim(),
          tone: fields.tone,
          kind,
          newDays: kind === 'new' ? days : null,
          sortOrder: auto && label ? label.sortOrder : Number(fields.sortOrder) || 0,
          isActive: fields.isActive,
        }),
      )
      if (result.response.ok) {
        setBusy(false)
        onBusy(false)
        onSaved(result.data)
        return
      }
      setErrors(fieldErrors(result.error))
      setFormError(problemMessage(result.error, 'Мітку не збережено.'))
    } catch {
      setFormError(NETWORK_ERROR)
    }
    setBusy(false)
    onBusy(false)
  }

  const shownError = formError ?? error

  return (
    <form className="label-editor-form" id={formId} noValidate onSubmit={submit} aria-label={label ? `Мітка «${label.name}»` : 'Нова мітка'}>
      <section className="catalog-card" aria-labelledby="label-appearance">
        <div className="label-preview">
          <CatalogSectionTitle id="label-appearance" icon={IconPalette}>Вигляд мітки</CatalogSectionTitle>
          <span aria-label="Попередній перегляд"><LabelChip name={fields.name.trim() || 'Мітка'} tone={fields.tone} /></span>
        </div>
        <Stack gap="xs">
          <TextInput label="Текст на плитці" required maxLength={30} value={fields.name} error={errors.name || undefined}
            onChange={(event) => set('name', event.currentTarget.value)} data-autofocus />
          <div role="radiogroup" aria-labelledby={`${formId}-tone`}>
            <Text component="span" id={`${formId}-tone`} className="catalog-field-label">Колір</Text>
            <div className="catalog-tone-picker">
              {LABEL_TONES.map((tone) => (
                <label key={tone.value} className="catalog-tone-option">
                  <input type="radio" name={`${formId}-tone`} value={tone.value} checked={fields.tone === tone.value} onChange={() => set('tone', tone.value)} />
                  <span aria-hidden="true" className={`catalog-label-chip is-${tone.value}`} />
                  <span className="catalog-tone-option-name">{tone.label}</span>
                </label>
              ))}
            </div>
            {errors.tone && <Text size="xs" c="red" role="alert">{errors.tone}</Text>}
          </div>
        </Stack>
      </section>
      <section className="catalog-card" aria-labelledby="label-display">
        <CatalogSectionTitle id="label-display" icon={IconEye}>Показ на вітрині</CatalogSectionTitle>
        <Stack gap="sm">
          {kind === 'new' && (
            <NumberInput label="Скільки днів товар новий" min={1} max={365} allowDecimal={false} value={fields.newDays}
              error={errors.newDays || undefined} onChange={(value) => set('newDays', value)} />
          )}
          {auto && (kind === 'sale' || kind === 'new') && <Text size="sm" c="dimmed">{AUTO_HELP[kind]}</Text>}
          {!auto && (
            <NumberInput label="Порядок на плитці" allowDecimal={false} value={fields.sortOrder} error={errors.sortOrder || undefined}
              onChange={(value) => set('sortOrder', value)} />
          )}
          <Switch label="Показувати на сайті" checked={fields.isActive} onChange={(event) => set('isActive', event.currentTarget.checked)} />
        </Stack>
      </section>
      {shownError && <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">{shownError}</Alert>}
    </form>
  )
}
