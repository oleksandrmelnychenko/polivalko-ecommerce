import { Alert, NumberInput, SimpleGrid, Stack, Switch, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { saveLabel, type LabelTone, type ProductLabel } from '../api/dictionariesApi'
import { DEFAULT_NEW_DAYS, isAutoLabel, LABEL_TONES } from '../lib/labels'
import { LabelChip } from './LabelChip'

type LabelFormProps = {
  formId: string
  label: ProductLabel | null
  nextSortOrder: number
  error: string | null
  onBusy: (busy: boolean) => void
  onSaved: () => void
}

type Fields = { name: string; tone: LabelTone; newDays: number | string; sortOrder: number | string; isActive: boolean }

const AUTO_HELP = {
  sale: 'Ставиться сама, коли стара ціна з Navkolo більша за поточну, і знімається, щойно знижка закінчується. Вручну її не призначають.',
  new: 'Ставиться сама на вказану кількість днів від першої появи товару в каталозі. Вручну її не призначають.',
} as const

export function LabelForm({ formId, label, nextSortOrder, error, onBusy, onSaved }: LabelFormProps) {
  const auto = label !== null && isAutoLabel(label)
  const [fields, setFields] = useState<Fields>(() => ({
    name: label?.name ?? '',
    tone: label?.tone ?? 'orange',
    newDays: label?.newDays ?? DEFAULT_NEW_DAYS,
    sortOrder: label?.sortOrder ?? nextSortOrder,
    isActive: label?.isActive ?? true,
  }))
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
    if (kind === 'new' && (!Number.isInteger(days) || days < 1)) {
      setErrors({ newDays: 'Вкажіть щонайменше 1 день.' })
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
        onSaved()
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
    <form id={formId} noValidate onSubmit={submit} aria-label={label ? `Мітка «${label.name}»` : 'Нова мітка'}>
      <Stack gap="sm">
        {auto && (kind === 'sale' || kind === 'new') ? (
          <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />} title="Автоматична мітка">
            {AUTO_HELP[kind]} Тут можна змінити текст, колір{kind === 'new' ? ', кількість днів' : ''} і вимкнути її.
          </Alert>
        ) : null}
        <TextInput
          label="Текст на плитці"
          required
          maxLength={30}
          value={fields.name}
          error={errors.name || undefined}
          onChange={(event) => set('name', event.currentTarget.value)}
          data-autofocus
        />
        <div role="radiogroup" aria-labelledby={`${formId}-tone`}>
          <Text component="span" id={`${formId}-tone`} className="catalog-field-label">
            Колір
          </Text>
          <div className="catalog-tone-picker">
            {LABEL_TONES.map((tone) => (
              <label key={tone.value} className="catalog-tone-option">
                <input type="radio" name={`${formId}-tone`} value={tone.value} checked={fields.tone === tone.value} onChange={() => set('tone', tone.value)} />
                <LabelChip name={fields.name.trim() || 'Мітка'} tone={tone.value} />
                <span className="catalog-tone-option-name">{tone.label}</span>
              </label>
            ))}
          </div>
          {errors.tone ? (
            <Text size="xs" c="red" mt={4}>
              {errors.tone}
            </Text>
          ) : null}
        </div>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          {kind === 'new' ? (
            <NumberInput
              label="Скільки днів товар новий"
              min={1}
              max={365}
              allowDecimal={false}
              value={fields.newDays}
              error={errors.newDays || undefined}
              onChange={(value) => set('newDays', value)}
            />
          ) : null}
          {auto ? null : (
            <NumberInput
              label="Порядок на плитці"
              description="Що менше число, то ближче мітка до початку."
              inputWrapperOrder={['label', 'input', 'description', 'error']}
              allowDecimal={false}
              value={fields.sortOrder}
              error={errors.sortOrder || undefined}
              onChange={(value) => set('sortOrder', value)}
            />
          )}
        </SimpleGrid>
        <Switch
          label="Показувати на сайті"
          description={kind === 'manual' ? 'Вимкнена мітка лишається в товарах, але на сайті не видна.' : undefined}
          checked={fields.isActive}
          onChange={(event) => set('isActive', event.currentTarget.checked)}
        />
        {shownError ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
            {shownError}
          </Alert>
        ) : null}
      </Stack>
    </form>
  )
}
