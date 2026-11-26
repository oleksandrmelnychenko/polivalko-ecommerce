import { Button, Switch, Group, NumberInput, Text, Textarea, TextInput } from '@mantine/core'
import { IconDeviceFloppy, IconTools } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { useReportDirty } from '@/shared/lib/useReportDirty'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { saveService, uploadImage, type ServiceDirection } from '../api/contentApi'
import { useSaveForm } from '../lib/useSaveForm'
import { FormAlert } from './FormAlert'
import { ImageField } from '@/shared/ui/site/ImageField'
import { DrawerCancelButton } from '@/shared/ui/DrawerCancelButton'
import { RichTextField } from '@/shared/ui/RichTextField'
import { SeoSnippetFields, type EmptyHints } from '@/shared/ui/site/SeoSnippetFields'

const FORM_ID = 'content-direction-form'

// Service pages have no SEO templates: the shop falls back to the service name and short description.
const SERVICE_SEO_HINTS: EmptyHints = {
  title: 'Порожньо: заголовком стане назва послуги',
  description: 'Порожньо: описом стане короткий опис послуги',
  note: 'Порожні поля сайт заповнює назвою й коротким описом послуги. Заповнюйте їх, лише коли хочете окремий текст для пошуку.',
}

type ServiceDirectionDrawerProps = {
  direction: ServiceDirection | null
  opened: boolean
  onClose: () => void
  onSaved: (direction: ServiceDirection) => void
}

export function ServiceDirectionDrawer({ direction, opened, onClose, onSaved }: ServiceDirectionDrawerProps) {
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  const [uploading, setUploading] = useState(false)
  const locked = busy || uploading

  return (
    <AppEditorModal
      opened={opened}
      onClose={locked ? () => undefined : onClose}
      dirty={dirty && !locked}
      closeOnEscape={!locked}
      closeOnClickOutside={!locked}
      className="site-record-modal service-editor-modal"
      title={<MetricLabel icon={IconTools}>{direction?.name ?? 'Напрямок послуг'}</MetricLabel>}
      size="wide"
      footer={
        <Group justify="flex-end" gap="sm">
          <DrawerCancelButton disabled={locked} onCancel={onClose} />
          <Button type="submit" form={FORM_ID} loading={busy} disabled={uploading} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
            Зберегти напрямок
          </Button>
        </Group>
      }
    >
      {direction ? <DirectionForm key={direction.code} initial={direction} uploading={uploading} onUploading={setUploading} onBusy={setBusy} onSaved={onSaved} onDirty={setDirty} /> : null}
    </AppEditorModal>
  )
}

type DirectionFormProps = {
  initial: ServiceDirection
  uploading: boolean
  onUploading: (busy: boolean) => void
  onBusy: (busy: boolean) => void
  onSaved: (direction: ServiceDirection) => void
  onDirty: (dirty: boolean) => void
}

function DirectionForm({ initial, uploading, onUploading, onBusy, onSaved, onDirty }: DirectionFormProps) {
  const form = useSaveForm()
  const [description, setDescription] = useState(initial.description ?? '')
  const [sortOrder, setSortOrder] = useState<string | number>(initial.sortOrder)
  const [visible, setVisible] = useState(initial.isVisible)
  const [imageUrl, setImageUrl] = useState(initial.imageUrl ?? '')
  const [slug, setSlug] = useState(initial.slug === initial.defaultSlug ? '' : initial.slug)
  const [body, setBody] = useState(initial.bodyHtml ?? '')
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle ?? '')
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription ?? '')
  const snapshot = JSON.stringify([description, String(sortOrder), visible, imageUrl, slug, body, seoTitle, seoDescription])
  const pagePath = `/services/${slug.trim().toLowerCase() || initial.defaultSlug}`
  const [pristine] = useState(snapshot)
  useReportDirty(snapshot !== pristine, onDirty)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.busy || uploading) return
    const order = Number(sortOrder)
    if (String(sortOrder).trim() === '' || !Number.isInteger(order)) {
      form.invalid({ sortOrder: 'Вкажіть ціле число.' })
      return
    }
    onBusy(true)
    const result = await form.submit(
      (headers) => saveService(headers, initial.code, {
        description: description.trim() || null,
        sortOrder: order,
        isVisible: visible,
        imageUrl: imageUrl || null,
        // Empty strings clear a field (an empty address returns to the default one); null would keep the saved value.
        slug: slug.trim().toLowerCase(),
        bodyHtml: body,
        seoTitle: seoTitle.trim(),
        seoDescription: seoDescription.trim(),
      }),
      { done: 'Напрямок збережено.', failed: 'Напрямок не збережено.' },
    )
    onBusy(false)
    if (result?.data) onSaved(result.data)
  }

  return (
    <form id={FORM_ID} className="content-drawer-form" onSubmit={onSubmit} noValidate aria-label={initial.name}>
      <fieldset className="service-form-grid" disabled={form.busy}>
        <div className="service-form-fields">
          <Textarea
            label="Опис"
            description="До 1000 символів."
            value={description}
            maxLength={1000}
            autosize
            minRows={4}
            error={form.errors.description}
            onChange={(event) => {
              setDescription(event.currentTarget.value)
              form.clearField('description')
            }}
            data-autofocus
          />
          <NumberInput
            label="Порядок"
            value={sortOrder}
            allowDecimal={false}
            step={1}
            w="100%"
            error={form.errors.sortOrder}
            onChange={(value) => {
              setSortOrder(value)
              form.clearField('sortOrder')
            }}
          />
          <Switch
            label="Показувати на сайті"
            checked={visible}
            error={form.errors.isVisible}
            onChange={(event) => {
              setVisible(event.currentTarget.checked)
              form.clearField('isVisible')
            }}
          />
        </div>
        <div className="service-form-media">
          <ImageField
            uploadImage={uploadImage}
            label="Фото"
            description="Горизонтальне фото, від 960 px завширшки."
            disabled={form.busy || uploading}
            onUploading={onUploading}
            shape="wide"
            value={imageUrl}
            error={form.errors.imageUrl}
            onChange={(url) => {
              setImageUrl(url)
              form.clearField('imageUrl')
            }}
          />
        </div>
      </fieldset>
      <fieldset className="service-page-fields" disabled={form.busy}>
        <legend>Сторінка послуги на сайті</legend>
        <TextInput
          label="Адреса сторінки"
          description={`Порожньо: ${"/services/" + initial.defaultSlug}. Малі латинські літери, цифри й дефіси.`}
          leftSection={<Text size="xs" c="dimmed" pl={6}>/services/</Text>}
          leftSectionWidth={74}
          placeholder={initial.defaultSlug}
          value={slug}
          maxLength={100}
          error={form.errors.slug}
          onChange={(event) => {
            setSlug(event.currentTarget.value)
            form.clearField('slug')
          }}
        />
        <RichTextField
          label="Текст сторінки"
          value={body}
          minRows={10}
          error={form.errors.bodyHtml}
          hint="Що входить у послугу, як проходить робота, для кого вона. Без тексту сторінка не показується в пошуку Google."
          onChange={(html) => {
            setBody(html)
            form.clearField('bodyHtml')
          }}
        />
        <SeoSnippetFields
          path={pagePath}
          seoTitle={seoTitle}
          seoDescription={seoDescription}
          fallbackTitle={initial.name}
          fallbackDescription={description}
          emptyHints={SERVICE_SEO_HINTS}
          errors={{ seoTitle: form.errors.seoTitle, seoDescription: form.errors.seoDescription }}
          onChange={(field, value) => {
            if (field === 'seoTitle') setSeoTitle(value)
            else setSeoDescription(value)
            form.clearField(field)
          }}
        />
      </fieldset>
      <FormAlert error={form.error} />
    </form>
  )
}
