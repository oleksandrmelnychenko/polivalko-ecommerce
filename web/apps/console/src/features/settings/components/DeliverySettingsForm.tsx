import { Alert, Button, SimpleGrid, Stack, Switch, TextInput } from '@mantine/core'
import { IconAlertTriangle, IconDeviceFloppy } from '@tabler/icons-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { ApiQuery } from '@/shared/api/useApiQuery'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { PageHeader } from '@/shared/ui/PageHeader'
import { saveDeliverySettings, type DeliverySettings, type PickupPoint } from '../api/settingsApi'
import { fieldError, useSaveForm } from '../lib/useSaveForm'
import { FormAlert } from './FormAlert'
import { ListError } from './ListError'
import { pickupColumns } from './pickupColumns'
import { SectionCard } from './SectionCard'

const FORM_ID = 'settings-delivery-form'
const TEXT_LIMIT = 200

const getRowId = (row: PickupPoint) => row.code

type DeliverySettingsFormProps = {
  initial: DeliverySettings
  points: ApiQuery<PickupPoint[]>
  onSaved: (value: DeliverySettings) => void
  onEditPoint: (point: PickupPoint) => void
}

type Values = {
  novaPoshta: { enabled: boolean; cashOnDelivery: boolean }
  courier: { enabled: boolean; area: string; priceNote: string }
  pickup: { enabled: boolean }
}

function toValues(value: Partial<DeliverySettings>): Values {
  return {
    novaPoshta: { enabled: value.novaPoshta?.enabled ?? true, cashOnDelivery: value.novaPoshta?.cashOnDelivery ?? true },
    courier: { enabled: value.courier?.enabled ?? true, area: value.courier?.area ?? '', priceNote: value.courier?.priceNote ?? '' },
    pickup: { enabled: value.pickup?.enabled ?? true },
  }
}

function toBody(values: Values): DeliverySettings {
  return {
    novaPoshta: { ...values.novaPoshta },
    courier: { enabled: values.courier.enabled, area: values.courier.area.trim() || null, priceNote: values.courier.priceNote.trim() || null },
    pickup: { ...values.pickup },
  }
}

export function DeliverySettingsForm({ initial, points, onSaved, onEditPoint }: DeliverySettingsFormProps) {
  const form = useSaveForm()
  const [values, setValues] = useState(() => toValues(initial))
  const [saved, setSaved] = useState(() => JSON.stringify(toBody(toValues(initial))))
  const dirty = JSON.stringify(toBody(values)) !== saved
  const pointsFailed = points.status === 'error' || points.status === 'forbidden'
  const pointRows = pointsFailed ? [] : (points.data ?? [])
  const activePoints = pointRows.filter((point) => point.isActive).length
  const nothingEnabled = !values.novaPoshta.enabled && !values.courier.enabled && !values.pickup.enabled

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function set<G extends keyof Values>(group: G, patch: Partial<Values[G]>, field: string) {
    setValues((current) => ({ ...current, [group]: { ...current[group], ...patch } }))
    form.clearField(group, field)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.busy || !dirty || nothingEnabled) return
    const body = toBody(values)
    const result = await form.submit((headers) => saveDeliverySettings(headers, body), { done: 'Налаштування доставки збережено.', failed: 'Налаштування доставки не збережено.' })
    if (!result) return
    const next = result.data ?? body
    const nextValues = toValues(next)
    setValues(nextValues)
    setSaved(JSON.stringify(toBody(nextValues)))
    onSaved(next)
  }

  return (
    <div className="settings-page">
      <PageHeader
        title="Доставка"
        actions={
          <Button type="submit" form={FORM_ID} loading={form.busy} disabled={!dirty || nothingEnabled} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
            Зберегти
          </Button>
        }
      />
      <form id={FORM_ID} className="settings-form" onSubmit={onSubmit} noValidate aria-label="Способи доставки">
        <Stack gap="lg">
          <p className="settings-lead">Які способи отримання бачить покупець під час оформлення замовлення. Зміни діють для нових замовлень одразу після збереження.</p>
          {nothingEnabled ? (
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} role="alert">
              Усі способи вимкнені: покупець не зможе оформити замовлення. Увімкніть хоча б один.
            </Alert>
          ) : (
            <FormAlert error={form.error} />
          )}

          <SectionCard title="Нова пошта" description="Відділення й поштомати по всій Україні. Вартість — за тарифами перевізника.">
            <Stack gap="sm">
              <Switch
                label="Доставка у відділення й поштомати"
                checked={values.novaPoshta.enabled}
                error={fieldError(form.errors, 'novaPoshta', 'enabled')}
                onChange={(event) => set('novaPoshta', { enabled: event.currentTarget.checked }, 'enabled')}
              />
              <Switch
                label="Післяплата"
                description="Покупець оплачує замовлення під час отримання на пошті."
                checked={values.novaPoshta.cashOnDelivery}
                disabled={!values.novaPoshta.enabled}
                error={fieldError(form.errors, 'novaPoshta', 'cashOnDelivery')}
                onChange={(event) => set('novaPoshta', { cashOnDelivery: event.currentTarget.checked }, 'cashOnDelivery')}
              />
            </Stack>
          </SectionCard>

          <SectionCard title="Кур'єр" description="Доставка на адресу покупця.">
            <Stack gap="sm">
              <Switch
                label="Доставка кур'єром"
                checked={values.courier.enabled}
                error={fieldError(form.errors, 'courier', 'enabled')}
                onChange={(event) => set('courier', { enabled: event.currentTarget.checked }, 'enabled')}
              />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="sm">
                <TextInput
                  label="Зона доставки"
                  description="Куди везе кур'єр. Покупець бачить це під назвою способу."
                  placeholder="Уся Україна"
                  value={values.courier.area}
                  maxLength={TEXT_LIMIT}
                  disabled={!values.courier.enabled}
                  error={fieldError(form.errors, 'courier', 'area')}
                  onChange={(event) => set('courier', { area: event.currentTarget.value }, 'area')}
                />
                <TextInput
                  label="Примітка про вартість"
                  description="Наприклад, хто і як платить за доставку."
                  placeholder="За тарифами Нової пошти"
                  value={values.courier.priceNote}
                  maxLength={TEXT_LIMIT}
                  disabled={!values.courier.enabled}
                  error={fieldError(form.errors, 'courier', 'priceNote')}
                  onChange={(event) => set('courier', { priceNote: event.currentTarget.value }, 'priceNote')}
                />
              </SimpleGrid>
            </Stack>
          </SectionCard>

          <SectionCard
            title="Самовивіз"
            description="Покупець бачить самовивіз, лише коли він увімкнений тут і хоча б одна точка доступна для самовивозу. Останню доступну точку можна вимкнути, лише коли самовивіз вимкнений і збережений. Адресу, графік та інструкцію точки покупець бачить під час оформлення."
          >
            <Stack gap="sm">
              <Switch
                label="Самовивіз з магазину"
                checked={values.pickup.enabled}
                error={fieldError(form.errors, 'pickup', 'enabled')}
                onChange={(event) => set('pickup', { enabled: event.currentTarget.checked }, 'enabled')}
              />
              {values.pickup.enabled && points.data && activePoints === 0 ? (
                <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
                  Немає жодної доступної точки, тому покупець не побачить самовивіз. Відкрийте точку нижче й позначте «Доступна для самовивозу».
                </Alert>
              ) : null}
              <div className="settings-embedded-table">
                <DataTable
                  ariaLabel="Точки самовивозу"
                  columns={pickupColumns}
                  data={pointRows}
                  getRowId={getRowId}
                  isLoading={points.isLoading}
                  isFetching={points.isFetching}
                  minWidth={900}
                  maxHeight={360}
                  onRowClick={onEditPoint}
                  emptyText={pointsFailed ? <ListError problem={points.problem} onRetry={points.reload} /> : 'Точок самовивозу немає.'}
                />
              </div>
            </Stack>
          </SectionCard>
        </Stack>
      </form>
    </div>
  )
}
