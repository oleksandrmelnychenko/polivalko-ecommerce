import { Alert, Textarea, TextInput } from '@mantine/core'
import { IconAlertCircle, IconAlertTriangle, IconCertificate, IconPhoto } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useReportDirty } from '@/shared/lib/useReportDirty'
import { saveBrand, type Brand } from '../api/dictionariesApi'
import { CatalogSectionTitle } from './CatalogSectionTitle'
import { BrandMark } from './BrandMark'
import { ImageUploadField } from './ImageUploadField'

type BrandFormProps = {
  formId: string
  brand: Brand | null
  error: string | null
  onBusy: (busy: boolean) => void
  onSaved: (brand: Brand | undefined) => void
  onDirty?: (dirty: boolean) => void
}

type Fields = { name: string; slug: string; description: string; logoUrl: string | null }

const MAX_DESCRIPTION = 2000

export function BrandForm({ formId, brand, error, onBusy, onSaved, onDirty }: BrandFormProps) {
  const [fields, setFields] = useState<Fields>(() => ({
    name: brand?.name ?? '',
    slug: brand?.slug ?? '',
    description: brand?.description ?? '',
    logoUrl: brand?.logoUrl ?? null,
  }))
  const [pristine] = useState(() => JSON.stringify(fields))
  useReportDirty(JSON.stringify(fields) !== pristine, onDirty)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const renamed = brand !== null && brand.productCount > 0 && fields.name.trim() !== '' && fields.name.trim() !== brand.name

  function set<K extends keyof Fields>(name: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || uploading) return
    if (!fields.name.trim()) {
      setErrors({ name: 'Вкажіть назву.' })
      return
    }
    setBusy(true)
    onBusy(true)
    setFormError(null)
    try {
      const result = await withCsrf((headers) =>
        saveBrand(headers, brand?.id ?? null, {
          name: fields.name.trim(),
          slug: fields.slug.trim() || null,
          description: fields.description.trim() || null,
          logoUrl: fields.logoUrl,
        }),
      )
      if (result.response.ok) {
        setBusy(false)
        onBusy(false)
        onSaved(result.data)
        return
      }
      setErrors(fieldErrors(result.error))
      setFormError(problemMessage(result.error, 'Бренд не збережено.'))
    } catch {
      setFormError(NETWORK_ERROR)
    }
    setBusy(false)
    onBusy(false)
  }

  const shownError = formError ?? error

  return (
    <form className="brand-editor-form" id={formId} noValidate onSubmit={submit} aria-label={brand ? `Бренд «${brand.name}»` : 'Новий бренд'}>
      <section className="catalog-card" aria-labelledby="brand-identity">
        <CatalogSectionTitle id="brand-identity" icon={IconCertificate}>Основне</CatalogSectionTitle>
        <div className="brand-editor-fields">
          <TextInput
            label="Назва"
            required
            maxLength={200}
            value={fields.name}
            error={errors.name || undefined}
            onChange={(event) => set('name', event.currentTarget.value)}
            data-autofocus
          />
          {renamed && brand ? (
            <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={18} />}>
              Нова назва з&apos;явиться в усіх товарах бренду ({brand.productCount}).
            </Alert>
          ) : null}
          <TextInput
            label="Адреса"
            placeholder="Автоматично з назви"
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            maxLength={200}
            spellCheck={false}
            autoComplete="off"
            value={fields.slug}
            error={errors.slug || undefined}
            onChange={(event) => set('slug', event.currentTarget.value)}
          />
          <Textarea
            label="Опис"
            description={fields.description.length > 0 ? `${fields.description.length} / ${MAX_DESCRIPTION}` : undefined}
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            autosize
            minRows={3}
            maxRows={10}
            maxLength={MAX_DESCRIPTION}
            value={fields.description}
            error={errors.description || undefined}
            onChange={(event) => set('description', event.currentTarget.value)}
          />
        </div>
      </section>
      <section className="catalog-card" aria-labelledby="brand-media">
        <CatalogSectionTitle id="brand-media" icon={IconPhoto}>Логотип</CatalogSectionTitle>
        <ImageUploadField
          label="Зображення бренду"
          shape="square"
          value={fields.logoUrl}
          alt={fields.name}
          fallback={<BrandMark name={fields.name} logoUrl={null} />}
          disabled={busy}
          onUploadingChange={(value) => {
            setUploading(value)
            onBusy(value)
          }}
          error={errors.logoUrl || undefined}
          onChange={(url) => set('logoUrl', url)}
        />
      </section>
      {shownError ? (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
          {shownError}
        </Alert>
      ) : null}
    </form>
  )
}
