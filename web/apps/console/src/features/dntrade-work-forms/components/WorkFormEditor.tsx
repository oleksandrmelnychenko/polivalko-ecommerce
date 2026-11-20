import { Alert, Button, Fieldset, Group, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link, type To } from 'react-router-dom'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { LeaveGuard } from '@/shared/ui/LeaveGuard'
import { PageHeader } from '@/shared/ui/PageHeader'
import { saveWorkForm, type SaveWorkForm, type WorkFormData, type WorkFormRecord } from '../api/workFormsApi'
import type { openingBalanceChoices } from '../lib/openingBalanceChoices'
import {
  emptyWorkFormData, emptyWorkFormLine, WORK_DATA_FIELDS, WORK_FORM_DIRECTION, WORK_LINE_FIELDS,
  requiresWorkDataField, workDataFieldLabel, workFieldValue, workFormFields, type WorkDataField, type WorkLineField,
} from '../lib/workFormFields'
import { WORK_FORM_SECTIONS, WORK_FORM_STATUSES, WORK_FORM_TYPES, readWorkFormSection, readWorkFormStatus, readWorkFormType, workFormTypeOptions } from '../lib/workForms'
import { MAX_WORK_FORM_LINES, WorkFormLines, type WorkFormEditorLine } from './WorkFormLines'
import { WorkFormOrigin } from './WorkFormOrigin'

const FORM_ID = 'dntrade-work-form-editor'

type WorkFormEditorProps = {
  initial: Omit<SaveWorkForm, 'expectedVersion'>
  id: string
  version: number | null
  originLabel?: string
  originWarning?: string
  openingChoices?: ReturnType<typeof openingBalanceChoices>
  cancelTo: To
  currentTo: To
  onSaved: (saved: WorkFormRecord) => void
}

const dataFields = Object.keys(WORK_DATA_FIELDS) as WorkDataField[]
const lineFields = Object.keys(WORK_LINE_FIELDS) as WorkLineField[]

export function WorkFormEditor({ initial, id, version, originLabel, originWarning, openingChoices, cancelTo, currentTo, onSaved }: WorkFormEditorProps) {
  const [form, setForm] = useState(() => {
    const { section, type, status, title, documentDate, sourceRecordId, data } = initial
    return { section, type, status, title, documentDate, sourceRecordId, data }
  })
  const [lines, setLines] = useState<WorkFormEditorLine[]>(() => (initial.data.lines ?? []).map((value, index) => ({ key: String(index), value })))
  const [pristine] = useState(() => JSON.stringify({ ...form, data: { ...form.data, lines: initial.data.lines ?? [] } }))
  const nextLine = useRef(initial.data.lines?.length ?? 0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<{ message: string; conflict?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [confirming, setConfirming] = useState(false)
  const [openingChoice, setOpeningChoice] = useState<string | null>(null)
  const data = form.data
  const config = workFormFields(form.type)
  const forReview = form.status === 'ready'
  const dirty = pristine !== JSON.stringify({ ...form, data: { ...data, lines: lines.map(({ value }) => value) } })
  const statusOptions = WORK_FORM_STATUSES.filter(({ value }) => version !== null || value !== 'archived')

  function clearError(key: string) {
    setErrors((current) => {
      if (!Object.hasOwn(current, key)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function updateField<Field extends WorkDataField>(key: Field, value: WorkFormData[Field]) {
    setForm((current) => ({ ...current, data: { ...current.data, [key]: value } }))
    if (key === 'organization' || key === 'account' || key === 'currency' || key === 'amount') setOpeningChoice(null)
    clearError(`data.${key}`)
  }

  function changeType(type: Omit<SaveWorkForm, 'expectedVersion'>['type']) {
    if (form.type === type) return
    setForm((current) => ({ ...current, type, section: WORK_FORM_TYPES[type].section }))
    setErrors({})
  }

  function applyOpeningChoice(value: string | null) {
    const option = openingChoices?.find((item) => item.value === value)
    setOpeningChoice(value)
    if (!option) return
    const { organization, account, currency, amount } = option
    setForm((current) => ({ ...current, data: { ...current.data, organization, account, currency, amount } }))
    for (const field of ['organization', 'account', 'currency', 'amount']) clearError(`data.${field}`)
  }

  function addLine() {
    const key = String(nextLine.current++)
    setLines((current) => current.length >= MAX_WORK_FORM_LINES ? current : [...current, { key, value: emptyWorkFormLine() }])
    clearError('data.lines')
  }

  function editLine(key: string, field: WorkLineField, value: string) {
    const index = lines.findIndex((line) => line.key === key)
    setLines((current) => current.map((line) => line.key === key ? { key, value: { ...line.value, [field]: value } } : line))
    clearError(`data.lines[${index}].${field}`)
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key))
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !field.startsWith('data.lines'))))
  }

  async function save() {
    if (saving.current) return
    const title = form.title
    setErrors({})
    setFailure(null)
    if (!title.trim()) {
      setErrors({ title: 'Вкажіть назву форми.' })
      return
    }

    saving.current = true
    setBusy(true)
    const sameType = version !== null && form.type === initial.type
    const applicableFields = dataFields.filter((field) => sameType || config.fields.includes(field) || field === 'note')
    const applicableLineFields = lineFields.filter((field) => sameType || config.lines.includes(field))
    const normalized: WorkFormData = {
      ...emptyWorkFormData(),
      ...Object.fromEntries(applicableFields.map((field) => [field, workFieldValue(data[field], WORK_DATA_FIELDS[field])])),
      lines: config.lines.length || sameType ? lines.map(({ value }) => ({
        ...emptyWorkFormLine(),
        ...Object.fromEntries(applicableLineFields.map((field) => [field, workFieldValue(value[field], WORK_LINE_FIELDS[field])])),
      })) : [],
    }
    try {
      const result = await saveWorkForm(id, { ...form, title, expectedVersion: version, data: normalized })
      if (result.data && result.response.ok) {
        onSaved(result.data)
      } else {
        const nextErrors = fieldErrors(result.error)
        setErrors(nextErrors)
        if (!Object.keys(nextErrors).length) {
          setFailure({
            message: problemMessage(result.error, 'Робочу форму не збережено.'),
            conflict: result.response.status === 409,
          })
        }
      }
    } catch {
      setFailure({ message: NETWORK_ERROR })
    } finally {
      saving.current = false
      setBusy(false)
      setConfirming(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (saving.current) return
    if (form.status === 'archived') setConfirming(true)
    else void save()
  }

  return (
    <>
      <PageHeader title={version === null ? 'Нова форма DNTrade' : `Редагування · ${initial.title}`} actions={(
        <Group gap="xs">
          <Button component={Link} to={cancelTo} variant="default" disabled={busy}>Скасувати</Button>
          <Button type="submit" form={FORM_ID} loading={busy} leftSection={<IconDeviceFloppy size={17} />}>Зберегти форму</Button>
        </Group>
      )} />
      <div className="dntrade-work-form-body">
        <form id={FORM_ID} className="dntrade-work-form-content" aria-label="Редактор робочої форми DNTrade" noValidate onSubmit={submit}>
          <Stack gap="md">
            {failure ? (
              <Alert title="Форму не збережено" color="red" role="alert">
                {failure.message}
                {failure.conflict ? <Button component={Link} to={currentTo} variant="default" size="xs" mt="xs" display="block">Переглянути серверну версію</Button> : null}
              </Alert>
            ) : null}
            {Object.keys(errors).length ? (
              <Alert title="Перевірте поля форми" color="red" role="alert">
                {[...new Set(Object.values(errors))].map((error) => <div key={error}>{error}</div>)}
              </Alert>
            ) : null}
            <Fieldset legend="Робоча форма" className="dntrade-work-form-group" disabled={busy}>
              <Stack gap="sm">
                <TextInput
                  required name="title" label="Назва форми" maxLength={200} value={form.title} error={errors.title}
                  onChange={(event) => { setForm({ ...form, title: event.currentTarget.value }); clearError('title') }}
                />
                <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="sm">
                  <Select
                    label="Розділ" data={[...WORK_FORM_SECTIONS]} value={form.section} allowDeselect={false} error={errors.section}
                    onChange={(value) => {
                      const section = readWorkFormSection(value)
                      if (section && section !== form.section) changeType(workFormTypeOptions(section)[0].value)
                    }}
                  />
                  <Select
                    label="Тип форми" data={workFormTypeOptions(form.section)} value={form.type} allowDeselect={false} error={errors.type}
                    onChange={(value) => {
                      const type = readWorkFormType(value)
                      if (type) changeType(type)
                    }}
                  />
                  <Select
                    label="Статус" data={statusOptions} value={form.status} allowDeselect={false} error={errors.status}
                    onChange={(value) => {
                      const status = readWorkFormStatus(value)
                      if (status) setForm({ ...form, status })
                      clearError('status')
                    }}
                  />
                  <TextInput
                    type="date" label="Дата документа" value={form.documentDate ?? ''} error={errors.documentDate} required={forReview && form.section !== 'directory'}
                    onChange={(event) => { setForm({ ...form, documentDate: event.currentTarget.value || null }); clearError('documentDate') }}
                  />
                </SimpleGrid>
              </Stack>
            </Fieldset>
            {form.sourceRecordId ? <WorkFormOrigin id={form.sourceRecordId} label={originLabel} error={errors.sourceRecordId} /> : null}
            {originWarning ? <Alert color="yellow" role="status">{originWarning}</Alert> : null}
            <Fieldset legend={config.details} className="dntrade-work-form-group" disabled={busy}>
              <Stack gap="sm">
                {form.type === 'opening-balance' && openingChoices?.length ? (
                  <Select
                    label="Рахунок або каса зі звіту"
                    placeholder="Оберіть запис для цієї форми"
                    data={openingChoices.map(({ value, label }) => ({ value, label }))}
                    value={openingChoice}
                    searchable
                    onChange={applyOpeningChoice}
                  />
                ) : null}
                <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="sm">
                  {config.fields.map((field) => {
                    const definition = WORK_DATA_FIELDS[field]
                    const label = workDataFieldLabel(field, form.type)
                    const error = errors[`data.${field}`]
                    const required = forReview && requiresWorkDataField(form.type, field)
                    if (field === 'direction') return (
                      <Select
                        key={field} label={label} value={data.direction} data={[...WORK_FORM_DIRECTION]} clearable error={error} required={required}
                        onChange={(value) => updateField(field, value === 'in' || value === 'out' ? value : null)}
                      />
                    )
                    return (
                      <TextInput
                        key={field} label={label} value={data[field] ?? ''} maxLength={definition.maxLength} error={error} required={required}
                        inputMode={definition.format === 'decimal' ? 'decimal' : definition.format === 'email' ? 'email' : definition.format === 'tel' ? 'tel' : undefined}
                        onChange={(event) => updateField(field, event.currentTarget.value)}
                      />
                    )
                  })}
                </SimpleGrid>
              </Stack>
            </Fieldset>
            <WorkFormLines type={form.type} lines={lines} errors={errors} onAdd={addLine} onChange={editLine} onRemove={removeLine} disabled={busy} forReview={forReview} />
            <Fieldset legend="Примітки" className="dntrade-work-form-group" disabled={busy}>
              <Textarea aria-label="Примітки" autosize minRows={3} maxRows={12} maxLength={WORK_DATA_FIELDS.note.maxLength} value={data.note ?? ''}
                error={errors['data.note']} onChange={(event) => updateField('note', event.currentTarget.value)} />
            </Fieldset>
          </Stack>
        </form>
      </div>
      <LeaveGuard when={dirty || busy} />
      <ConfirmDialog
        opened={confirming}
        title="Архівувати робочу форму"
        message="Після архівування форма буде доступна лише для перегляду."
        confirmLabel="Архівувати"
        busy={busy}
        onClose={() => setConfirming(false)}
        onConfirm={() => { void save() }}
      />
    </>
  )
}
