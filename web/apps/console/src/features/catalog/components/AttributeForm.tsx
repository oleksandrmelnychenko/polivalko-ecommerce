import { Alert, NumberInput, SegmentedControl, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconAlertTriangle } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useReportDirty } from '@/shared/lib/useReportDirty'
import { saveAttribute, type AttributeDefinition, type AttributeFilterView, type AttributeKind } from '../api/dictionariesApi'
import { ATTRIBUTE_KIND_OPTIONS, FILTER_VIEW_OPTIONS } from '../lib/attributes'

type AttributeFormProps = {
  formId: string
  attribute: AttributeDefinition | null
  nextSortOrder: number
  error: string | null
  onBusy: (busy: boolean) => void
  onSaved: (attribute: AttributeDefinition | undefined) => void
  onDirty?: (dirty: boolean) => void
}

type Fields = {
  name: string
  unit: string
  kind: AttributeKind
  filterView: AttributeFilterView
  sortOrder: number | string
}

export function AttributeForm({ formId, attribute, nextSortOrder, error, onBusy, onSaved, onDirty }: AttributeFormProps) {
  const [fields, setFields] = useState<Fields>(() => ({
    name: attribute?.name ?? '',
    unit: attribute?.unit ?? '',
    kind: attribute?.kind ?? 'list',
    filterView: attribute?.filterView ?? 'checkboxes',
    sortOrder: attribute?.sortOrder ?? nextSortOrder,
  }))
  const [pristine] = useState(() => JSON.stringify(fields))
  useReportDirty(JSON.stringify(fields) !== pristine, onDirty)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const renamed = attribute !== null && fields.name.trim() !== '' && fields.name.trim() !== attribute.name
  const rangeAllowed = fields.kind === 'number'

  function set<K extends keyof Fields>(name: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  function setKind(kind: AttributeKind) {
    setFields((current) => ({ ...current, kind, filterView: kind === 'number' ? current.filterView : 'checkboxes' }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!fields.name.trim()) {
      setErrors({ name: 'Вкажіть назву.' })
      return
    }
    setBusy(true)
    onBusy(true)
    setFormError(null)
    try {
      const result = await withCsrf((headers) =>
        saveAttribute(headers, attribute?.id ?? null, {
          name: fields.name.trim(),
          unit: fields.unit.trim() || null,
          kind: fields.kind,
          filterView: rangeAllowed ? fields.filterView : 'checkboxes',
          sortOrder: Number(fields.sortOrder) || 0,
          aliases: attribute?.aliases ?? [],
        }),
      )
      if (result.response.ok) {
        setBusy(false)
        onBusy(false)
        onSaved(result.data)
        return
      }
      setErrors(fieldErrors(result.error))
      setFormError(problemMessage(result.error, 'Характеристику не збережено.'))
    } catch {
      setFormError(NETWORK_ERROR)
    }
    setBusy(false)
    onBusy(false)
  }

  const shownError = formError ?? error

  return (
    <form id={formId} noValidate onSubmit={submit} aria-label={attribute ? `Характеристика «${attribute.name}»` : 'Нова характеристика'}>
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <TextInput
            label="Назва"
            required
            maxLength={100}
            value={fields.name}
            error={errors.name || undefined}
            onChange={(event) => set('name', event.currentTarget.value)}
            data-autofocus
          />
          <TextInput
            label="Одиниця"
            placeholder="см, л, Вт…"
            maxLength={20}
            value={fields.unit}
            error={errors.unit || undefined}
            onChange={(event) => set('unit', event.currentTarget.value)}
          />
        </SimpleGrid>
        {renamed && attribute ? (
          <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={18} />}>
            Нова назва з&apos;явиться в усіх товарах ({attribute.productCount}) і у фільтрах категорій ({attribute.categoryCount}). Значення характеристик не зміняться.
          </Alert>
        ) : null}
        <div className="catalog-editor-options">
          <div>
            <Text component="span" id={`${formId}-kind`} className="catalog-field-label">
              Тип значень
            </Text>
            <SegmentedControl aria-labelledby={`${formId}-kind`} fullWidth data={ATTRIBUTE_KIND_OPTIONS} value={fields.kind} onChange={(value) => setKind(value as AttributeKind)} />
          </div>
          <div>
            <Text component="span" id={`${formId}-view`} className="catalog-field-label">
              Вигляд у фільтрі
            </Text>
            <SegmentedControl
              aria-labelledby={`${formId}-view`}
              fullWidth
              data={FILTER_VIEW_OPTIONS.map((option) => ({ ...option, disabled: option.value === 'range' && !rangeAllowed }))}
              value={rangeAllowed ? fields.filterView : 'checkboxes'}
              onChange={(value) => set('filterView', value as AttributeFilterView)}
            />
            {!rangeAllowed && <Text size="xs" c="dimmed" mt={4}>Для діапазону оберіть тип «Число».</Text>}
          </div>
        </div>
        <NumberInput
          label="Порядок у фільтрах"
          allowDecimal={false}
          value={fields.sortOrder}
          error={errors.sortOrder || undefined}
          onChange={(value) => set('sortOrder', value)}
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
