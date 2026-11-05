import { Alert, Stack, Textarea, TextInput } from '@mantine/core'
import { IconAlertCircle, IconAlertTriangle } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { saveBrand, type Brand } from '../api/dictionariesApi'
import { ImageUploadField } from './ImageUploadField'

type BrandFormProps = {
  formId: string
  brand: Brand | null
  error: string | null
  onBusy: (busy: boolean) => void
  onSaved: (brand: Brand | undefined) => void
}

type Fields = { name: string; slug: string; description: string; logoUrl: string | null }

const MAX_DESCRIPTION = 2000

export function BrandForm({ formId, brand, error, onBusy, onSaved }: BrandFormProps) {
  const [fields, setFields] = useState<Fields>(() => ({
    name: brand?.name ?? '',
    slug: brand?.slug ?? '',
    description: brand?.description ?? '',
    logoUrl: brand?.logoUrl ?? null,
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const renamed = brand !== null && brand.productCount > 0 && fields.name.trim() !== '' && fields.name.trim() !== brand.name

  function set<K extends keyof Fields>(name: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
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
      setFormError(problemMessage(result.error, 'Не збережено.'))
    } catch {
      setFormError(NETWORK_ERROR)
    }
    setBusy(false)
    onBusy(false)
  }

  const shownError = formError ?? error

  return (
    <form id={formId} noValidate onSubmit={submit} aria-label={brand ? `Бренд «${brand.name}»` : 'Новий бренд'}>
      <Stack gap="sm">
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
            Бренд буде перейменовано в усіх його товарах ({brand.productCount}).
          </Alert>
        ) : null}
        <TextInput
          label="Адреса (порожньо — з назви)"
          maxLength={200}
          spellCheck={false}
          autoComplete="off"
          value={fields.slug}
          error={errors.slug || undefined}
          onChange={(event) => set('slug', event.currentTarget.value)}
        />
        <ImageUploadField
          label="Логотип"
          shape="square"
          value={fields.logoUrl}
          alt={fields.name}
          description="Краще PNG або WebP на прозорому чи білому тлі."
          error={errors.logoUrl || undefined}
          onChange={(url) => set('logoUrl', url)}
        />
        <Textarea
          label="Опис"
          description={`${fields.description.length} з ${MAX_DESCRIPTION}.`}
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          autosize
          minRows={3}
          maxRows={10}
          maxLength={MAX_DESCRIPTION}
          value={fields.description}
          error={errors.description || undefined}
          onChange={(event) => set('description', event.currentTarget.value)}
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
