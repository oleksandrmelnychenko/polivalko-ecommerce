import { Button, Group, SimpleGrid, Stack, Switch, Textarea, TextInput } from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { AppDateInput } from '@/shared/ui/AppDateInput'
import { AppDrawer } from '@/shared/ui/AppDrawer'
import { saveBanner, type Banner, type SaveBannerRequest } from '../api/siteApi'
import { isLink } from '../lib/homeSettings'
import { invalidPeriod, periodDay, periodEnd, periodStart } from '../lib/period'
import { fieldError, useSaveForm } from '../lib/useSaveForm'
import { FormAlert } from './FormAlert'
import { ImageField } from './ImageField'

const FORM_ID = 'site-banner-form'

const BANNER_LIMITS = { kicker: 40, title: 80, text: 200, buttonLabel: 30, link: 300 } as const

type BannerDrawerProps = {
  editing: { banner: Banner | null; opened: boolean; seq: number }
  onClose: () => void
  onSaved: (banner: Banner, created: boolean) => void
}

export function BannerDrawer({ editing, onClose, onSaved }: BannerDrawerProps) {
  const [busy, setBusy] = useState(false)
  const banner = editing.banner

  return (
    <AppDrawer
      opened={editing.opened}
      onClose={busy ? () => undefined : onClose}
      title={banner ? `Банер «${banner.title}»` : 'Новий банер'}
      size="compact"
      footer={
        <Group justify="flex-end" gap="sm">
          <Button variant="default" disabled={busy} onClick={onClose}>
            Скасувати
          </Button>
          <Button type="submit" form={FORM_ID} loading={busy} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
            {banner ? 'Зберегти банер' : 'Додати банер'}
          </Button>
        </Group>
      }
    >
      <BannerForm key={`${banner?.id ?? 'new'}:${editing.seq}`} initial={banner} onBusy={setBusy} onSaved={onSaved} />
    </AppDrawer>
  )
}

type Values = {
  kicker: string
  title: string
  text: string
  buttonLabel: string
  link: string
  imageUrl: string
  mobileImageUrl: string
  from: string
  to: string
  isActive: boolean
}

function toValues(banner: Banner | null): Values {
  return {
    kicker: banner?.kicker ?? '',
    title: banner?.title ?? '',
    text: banner?.text ?? '',
    buttonLabel: banner?.buttonLabel ?? '',
    link: banner?.link ?? '',
    imageUrl: banner?.imageUrl ?? '',
    mobileImageUrl: banner?.mobileImageUrl ?? '',
    from: periodDay(banner?.startsAt),
    to: periodDay(banner?.endsAt),
    isActive: banner?.isActive ?? true,
  }
}

function toBody(values: Values): SaveBannerRequest {
  return {
    kicker: values.kicker.trim() || null,
    title: values.title.trim(),
    text: values.text.trim() || null,
    buttonLabel: values.buttonLabel.trim() || null,
    link: values.link.trim() || null,
    imageUrl: values.imageUrl,
    mobileImageUrl: values.mobileImageUrl || null,
    startsAt: periodStart(values.from),
    endsAt: periodEnd(values.to),
    isActive: values.isActive,
  }
}

function validate(values: Values): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.title.trim()) errors.title = 'Вкажіть заголовок.'
  if (!values.imageUrl) errors.imageUrl = "Завантажте фото для комп'ютера."
  const link = values.link.trim()
  if (link && !isLink(link)) errors.link = 'Посилання має починатися з / або https://.'
  if (values.buttonLabel.trim() && !link) errors.link = 'Для кнопки вкажіть посилання.'
  if (invalidPeriod(values.from, values.to)) errors.endsAt = 'Дата завершення раніше за дату початку.'
  return errors
}

type BannerFormProps = {
  initial: Banner | null
  onBusy: (busy: boolean) => void
  onSaved: (banner: Banner, created: boolean) => void
}

function BannerForm({ initial, onBusy, onSaved }: BannerFormProps) {
  const form = useSaveForm()
  const [values, setValues] = useState(() => toValues(initial))

  function set<K extends keyof Values>(field: K, value: Values[K], errorField: string = field) {
    setValues((current) => ({ ...current, [field]: value }))
    form.clearField(errorField)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.busy) return
    const errors = validate(values)
    if (Object.keys(errors).length > 0) {
      form.invalid(errors)
      return
    }
    onBusy(true)
    const result = await form.submit((headers) => saveBanner(headers, initial?.id ?? null, toBody(values)), {
      done: initial ? 'Банер збережено.' : 'Банер додано.',
      failed: 'Банер не збережено.',
    })
    onBusy(false)
    if (result?.data) onSaved(result.data, !initial)
  }

  return (
    <form id={FORM_ID} className="site-drawer-form" onSubmit={onSubmit} noValidate aria-label={initial ? `Банер «${initial.title}»` : 'Новий банер'}>
      <Stack gap="md">
        <TextInput
          label="Напис над заголовком"
          description={`Короткий рядок над заголовком на слайді, до ${BANNER_LIMITS.kicker} символів. Можна лишити порожнім.`}
          placeholder="Акції"
          value={values.kicker}
          maxLength={BANNER_LIMITS.kicker}
          error={fieldError(form.errors, 'kicker')}
          onChange={(event) => set('kicker', event.currentTarget.value)}
        />
        <TextInput
          label="Заголовок"
          required
          value={values.title}
          maxLength={BANNER_LIMITS.title}
          error={fieldError(form.errors, 'title')}
          onChange={(event) => set('title', event.currentTarget.value)}
          data-autofocus
        />
        <Textarea
          label="Текст"
          description={`Рядок під заголовком, до ${BANNER_LIMITS.text} символів. Можна лишити порожнім.`}
          autosize
          minRows={2}
          value={values.text}
          maxLength={BANNER_LIMITS.text}
          error={fieldError(form.errors, 'text')}
          onChange={(event) => set('text', event.currentTarget.value)}
        />
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" verticalSpacing="sm">
          <TextInput
            label="Напис на кнопці"
            placeholder="Перейти до каталогу"
            value={values.buttonLabel}
            maxLength={BANNER_LIMITS.buttonLabel}
            error={fieldError(form.errors, 'buttonLabel')}
            onChange={(event) => set('buttonLabel', event.currentTarget.value)}
          />
          <TextInput
            label="Посилання"
            placeholder="/catalog"
            value={values.link}
            maxLength={BANNER_LIMITS.link}
            spellCheck={false}
            autoComplete="off"
            error={fieldError(form.errors, 'link')}
            onChange={(event) => set('link', event.currentTarget.value)}
          />
        </SimpleGrid>
        <ImageField
          label="Фото для комп'ютера"
          description="Горизонтальне, найкраще 1600 × 600 px або більше."
          required
          shape="wide"
          value={values.imageUrl}
          error={fieldError(form.errors, 'imageUrl')}
          onChange={(url) => set('imageUrl', url)}
        />
        <ImageField
          label="Фото для телефона"
          description="Вертикальне або квадратне. Без нього телефон покаже фото для комп'ютера."
          shape="tall"
          value={values.mobileImageUrl}
          error={fieldError(form.errors, 'mobileImageUrl')}
          onChange={(url) => set('mobileImageUrl', url)}
        />
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" verticalSpacing="sm">
          <AppDateInput
            label="Показувати з"
            description="Якщо дату не вказати, показ почнеться одразу після збереження."
            value={values.from}
            max={values.to || undefined}
            error={fieldError(form.errors, 'startsAt')}
            onChange={(from) => set('from', from, 'startsAt')}
          />
          <AppDateInput
            label="Показувати до"
            description="Включно з цією датою. Без дати показ триває без обмежень."
            value={values.to}
            min={values.from || undefined}
            error={fieldError(form.errors, 'endsAt')}
            onChange={(to) => set('to', to, 'endsAt')}
          />
        </SimpleGrid>
        <Switch
          label="Активний"
          description="Вимкнений банер не показується навіть у межах дат."
          checked={values.isActive}
          onChange={(event) => set('isActive', event.currentTarget.checked)}
        />
        <FormAlert error={form.error} />
      </Stack>
    </form>
  )
}
