import { Alert, Button, SimpleGrid, Stack, Switch, TextInput } from '@mantine/core'
import { IconAlertTriangle, IconBuildingStore, IconDeviceFloppy, IconMailbox, IconTruckDelivery } from '@tabler/icons-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { ApiQuery } from '@/shared/api/useApiQuery'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { TableChip } from '@/shared/ui/TableChip'
import { saveDeliverySettings, type DeliverySettings, type PickupPoint } from '../api/settingsApi'
import { fieldError, useSaveForm } from '../lib/useSaveForm'
import { FormAlert } from './FormAlert'
import { ListError } from './ListError'
import { pickupColumns } from './pickupColumns'
import { SettingsCard, SettingsDirty, SettingsHero, SettingsSectionList, useErrorSections, useJumpToErrors, useSettingsSection, type SettingsSection } from './SettingsSplit'

const FORM_ID = 'settings-delivery-form'
const TEXT_LIMIT = 200

type DeliverySectionKey = 'novaPoshta' | 'courier' | 'pickup'

const SECTION_KEYS: readonly DeliverySectionKey[] = ['novaPoshta', 'courier', 'pickup']

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

function sectionOfField(field: string): DeliverySectionKey | null {
  const head = field.split('.')[0]
  if (head === 'novaposhta') return 'novaPoshta'
  if (head === 'courier') return 'courier'
  if (head === 'pickup') return 'pickup'
  return null
}

function onOff(enabled: boolean) {
  return enabled ? <TableChip dot tone="success" value="Увімкнено" /> : <TableChip dot tone="neutral" value="Вимкнено" />
}

export function DeliverySettingsForm({ initial, points, onSaved, onEditPoint }: DeliverySettingsFormProps) {
  const form = useSaveForm()
  const [values, setValues] = useState(() => toValues(initial))
  const [saved, setSaved] = useState(() => JSON.stringify(toBody(toValues(initial))))
  const dirty = JSON.stringify(toBody(values)) !== saved
  const pointsFailed = points.status === 'error' || points.status === 'forbidden'
  const pointRows = pointsFailed ? [] : (points.data ?? [])
  const activePoints = pointRows.filter((point) => point.isActive).length
  const noPoints = values.pickup.enabled && Boolean(points.data) && activePoints === 0
  const nothingEnabled = !values.novaPoshta.enabled && !values.courier.enabled && !values.pickup.enabled
  const [active, select] = useSettingsSection(SECTION_KEYS)
  const invalid = useErrorSections(form.errors, sectionOfField)
  useJumpToErrors(SECTION_KEYS, invalid, active, select)

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

  const sections: SettingsSection<DeliverySectionKey>[] = [
    {
      key: 'novaPoshta',
      name: 'Нова пошта',
      hint: values.novaPoshta.enabled && values.novaPoshta.cashOnDelivery ? 'Відділення й поштомати, з післяплатою' : 'Відділення й поштомати',
      icon: IconMailbox,
      state: onOff(values.novaPoshta.enabled),
      invalid: invalid.has('novaPoshta'),
    },
    {
      key: 'courier',
      name: "Кур'єр",
      hint: values.courier.area.trim() || 'Доставка на адресу покупця',
      icon: IconTruckDelivery,
      state: onOff(values.courier.enabled),
      invalid: invalid.has('courier'),
    },
    {
      key: 'pickup',
      name: 'Самовивіз',
      hint: points.data ? `Доступних точок: ${activePoints} з ${pointRows.length}` : 'Точки самовивозу',
      icon: IconBuildingStore,
      state: noPoints ? <TableChip dot tone="warning" value="Немає доступних точок" /> : onOff(values.pickup.enabled),
      invalid: invalid.has('pickup'),
    },
  ]

  const section = sections.find((item) => item.key === active) ?? sections[0]

  const top = nothingEnabled ? (
    <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} role="alert">
      Усі способи вимкнені: покупець не зможе оформити замовлення. Увімкніть хоча б один.
    </Alert>
  ) : form.error ? (
    <FormAlert error={form.error} />
  ) : null

  return (
    <ListPage>
      <PageHeader
        title="Доставка"
        actions={
          <>
            <SettingsDirty dirty={dirty} />
            <Button type="submit" form={FORM_ID} loading={form.busy} disabled={!dirty || nothingEnabled} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
              Зберегти зміни
            </Button>
          </>
        }
      />
      <ListPageBody>
        <form id={FORM_ID} className="app-split-layout settings-form" onSubmit={onSubmit} noValidate aria-label="Способи доставки">
          <SettingsSectionList label="Способи отримання" sections={sections} active={active} onSelect={select} top={top} />

          <section key={active} className="app-split-detail" aria-label={section.name}>
            {active === 'novaPoshta' ? (
              <>
                <SettingsHero
                  section={section}
                  kicker="Спосіб отримання"
                  description="Відділення й поштомати по всій Україні. Доставку покупець оплачує за тарифами перевізника. Зміни діють для нових замовлень одразу після збереження."
                />
                <SettingsCard title="Налаштування">
                  <Stack gap="md">
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
                </SettingsCard>
              </>
            ) : null}

            {active === 'courier' ? (
              <>
                <SettingsHero section={section} kicker="Спосіб отримання" description="Доставка на адресу покупця. Зміни діють для нових замовлень одразу після збереження." />
                <SettingsCard title="Налаштування">
                  <Stack gap="md">
                    <Switch
                      label="Доставка кур'єром"
                      checked={values.courier.enabled}
                      error={fieldError(form.errors, 'courier', 'enabled')}
                      onChange={(event) => set('courier', { enabled: event.currentTarget.checked }, 'enabled')}
                    />
                    <SimpleGrid cols={1} spacing="md" verticalSpacing="sm">
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
                </SettingsCard>
              </>
            ) : null}

            {active === 'pickup' ? (
              <>
                <SettingsHero
                  section={section}
                  kicker="Спосіб отримання"
                  description="Покупець бачить самовивіз, коли його ввімкнено тут і доступна хоча б одна точка. Адресу, графік та інструкцію точки покупець бачить під час оформлення."
                />
                <SettingsCard title="Налаштування">
                  <Switch
                    label="Самовивіз з магазину"
                    checked={values.pickup.enabled}
                    error={fieldError(form.errors, 'pickup', 'enabled')}
                    onChange={(event) => set('pickup', { enabled: event.currentTarget.checked }, 'enabled')}
                  />
                </SettingsCard>
                {noPoints ? (
                  <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
                    Немає жодної доступної точки, тому покупець не побачить самовивіз. Відкрийте точку нижче й позначте «Доступна для самовивозу».
                  </Alert>
                ) : null}
                <SettingsCard
                  title="Точки самовивозу"
                  description="Клік по точці відкриває її налаштування. Останню доступну точку можна вимкнути, лише коли самовивіз уже вимкнено й збережено."
                >
                  <div className="settings-embedded-table">
                    <DataTable
                      ariaLabel="Точки самовивозу"
                      columns={pickupColumns}
                      data={pointRows}
                      getRowId={getRowId}
                      isLoading={points.isLoading}
                      isFetching={points.isFetching}
                      minWidth={640}
                      maxHeight={420}
                      onRowClick={onEditPoint}
                      emptyText={pointsFailed ? <ListError problem={points.problem} onRetry={points.reload} /> : 'Точок самовивозу немає.'}
                    />
                  </div>
                </SettingsCard>
              </>
            ) : null}
          </section>
        </form>
      </ListPageBody>
    </ListPage>
  )
}
