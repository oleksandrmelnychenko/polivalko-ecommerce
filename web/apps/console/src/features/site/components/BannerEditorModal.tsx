import { Button, Group, SimpleGrid, Switch, Textarea, TextInput } from '@mantine/core'
import { IconDeviceFloppy, IconPhoto } from '@tabler/icons-react'
import { useRef, useState, type FormEvent } from 'react'
import { useReportDirty } from '@/shared/lib/useReportDirty'
import { AppDateInput } from '@/shared/ui/AppDateInput'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { saveBanner, uploadImage, type Banner, type SaveBannerRequest } from '../api/siteApi'
import { isLink } from '../lib/homeSettings'
import { invalidPeriod, periodDay, periodEnd, periodStart } from '../lib/period'
import { fieldError, useSaveForm } from '../lib/useSaveForm'
import { FormAlert } from './FormAlert'
import { ImageField } from '@/shared/ui/site/ImageField'
import { DrawerCancelButton } from '@/shared/ui/DrawerCancelButton'

const FORM_ID = 'site-banner-form'

const BANNER_LIMITS = { kicker: 40, title: 80, text: 200, buttonLabel: 30, link: 300 } as const

type BannerEditorModalProps = {
  editing: { banner: Banner | null; opened: boolean; seq: number }
  onClose: () => void
  onSaved: (banner: Banner, created: boolean) => void
}

export function BannerEditorModal({ editing, onClose, onSaved }: BannerEditorModalProps) {
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [uploading, setUploading] = useState(false)
  const locked = busy || uploading
  const banner = editing.banner

  return (
    <AppEditorModal
      opened={editing.opened}
      onClose={locked ? () => undefined : onClose}
      dirty={dirty && !locked}
      closeOnEscape={!locked}
      closeOnClickOutside={!locked}
      title={<span className="banner-modal-title"><IconPhoto size={18} aria-hidden="true" />{banner ? "Редагувати банер" : "Новий банер"}</span>}
      size="standard"
      className="banner-editor-modal"
      footer={
        <Group justify="flex-end" gap="sm">
          <DrawerCancelButton disabled={locked} onCancel={onClose} />
          <Button type="submit" form={FORM_ID} loading={busy} disabled={uploading} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
            {banner ? 'Зберегти банер' : 'Додати банер'}
          </Button>
        </Group>
      }
    >
      <BannerForm key={`${banner?.id ?? 'new'}:${editing.seq}`} initial={banner} uploading={uploading} onUploading={setUploading} onBusy={setBusy} onSaved={onSaved} onDirty={setDirty} />
    </AppEditorModal>
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
  uploading: boolean
  onUploading: (busy: boolean) => void
  onBusy: (busy: boolean) => void
  onSaved: (banner: Banner, created: boolean) => void
  onDirty: (dirty: boolean) => void
}

function BannerForm({ initial, uploading, onUploading, onBusy, onSaved, onDirty }: BannerFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const form = useSaveForm(formRef)
  const [values, setValues] = useState(() => toValues(initial))
  const [pristine] = useState(() => JSON.stringify(values))
  useReportDirty(JSON.stringify(values) !== pristine, onDirty)

  function set<K extends keyof Values>(field: K, value: Values[K], errorField: string = field) {
    setValues((current) => ({ ...current, [field]: value }))
    form.clearField(errorField)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.busy || uploading) return
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
    <form ref={formRef} id={FORM_ID} className="banner-form" onSubmit={onSubmit} noValidate aria-label={initial ? `Банер «${initial.title}»` : 'Новий банер'}>
      <fieldset disabled={form.busy} className="banner-form-grid">
        <section className="banner-form-section">
          <h3>Вміст слайда</h3>
          <TextInput
            label="Заголовок"
            required
            value={values.title}
            maxLength={BANNER_LIMITS.title}
            error={fieldError(form.errors, 'title')}
            onChange={(event) => set('title', event.currentTarget.value)}
            data-autofocus
          />
          <TextInput
            label="Напис над заголовком"
            placeholder="Акції"
            value={values.kicker}
            maxLength={BANNER_LIMITS.kicker}
            error={fieldError(form.errors, 'kicker')}
            onChange={(event) => set('kicker', event.currentTarget.value)}
          />
          <Textarea
            label="Текст"
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
        </section>
        <section className="banner-form-section banner-form-media">
          <h3>Зображення</h3>
          <ImageField
            uploadImage={uploadImage}
            disabled={uploading || form.busy}
            onUploading={onUploading}
            label="Фото для комп'ютера"
            description="Рекомендований розмір — від 1600 × 600 px."
            required
            shape="wide"
            value={values.imageUrl}
            error={fieldError(form.errors, 'imageUrl')}
            onChange={(url) => set('imageUrl', url)}
          />
          <ImageField
            uploadImage={uploadImage}
            disabled={uploading || form.busy}
            onUploading={onUploading}
            label="Фото для телефона"
            description="За замовчуванням використовується основне фото."
            shape="tall"
            value={values.mobileImageUrl}
            error={fieldError(form.errors, 'mobileImageUrl')}
            onChange={(url) => set('mobileImageUrl', url)}
          />
        </section>
        <section className="banner-form-section">
          <h3>Період показу</h3>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" verticalSpacing="sm">
            <AppDateInput
              label="Показувати з"
              value={values.from}
              max={values.to || undefined}
              error={fieldError(form.errors, 'startsAt')}
              onChange={(from) => set('from', from, 'startsAt')}
            />
            <AppDateInput
              label="Показувати до"
              value={values.to}
              min={values.from || undefined}
              error={fieldError(form.errors, 'endsAt')}
              onChange={(to) => set('to', to, 'endsAt')}
            />
          </SimpleGrid>
          <Switch
            label="Показувати банер"
            checked={values.isActive}
            onChange={(event) => set('isActive', event.currentTarget.checked)}
          />
        </section>
      </fieldset>
      <FormAlert error={form.error} />
    </form>
  )
}
