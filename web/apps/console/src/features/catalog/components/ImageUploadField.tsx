import { Button, FileButton, Group, Loader, Text } from '@mantine/core'
import { IconPhoto, IconPhotoUp, IconTrash } from '@tabler/icons-react'
import { useId, useState, type ReactNode } from 'react'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { uploadMediaImage } from '../api/dictionariesApi'
import './catalog-dictionaries.css'

type ImageUploadFieldProps = {
  label: string
  value: string | null
  onChange: (url: string | null) => void
  description?: string
  error?: string
  disabled?: boolean
  fallback?: ReactNode
  shape?: 'square' | 'wide'
  alt?: string
}

const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_BYTES = 10 * 1024 * 1024
const WRONG_TYPE = 'Підходять фото JPEG, PNG або WebP.'
const TOO_LARGE = 'Фото завелике: до 10 МБ.'

export function ImageUploadField({ label, value, onChange, description, error, disabled = false, fallback, shape = 'wide', alt = '' }: ImageUploadFieldProps) {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function upload(file: File | null) {
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type)) {
      setUploadError(WRONG_TYPE)
      return
    }
    if (file.size === 0) {
      setUploadError('Файл порожній.')
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadError(TOO_LARGE)
      return
    }
    setBusy(true)
    setUploadError(null)
    try {
      const result = await uploadMediaImage(file)
      if (result.data?.url) onChange(result.data.url)
      else if (result.response.status === 413) setUploadError(TOO_LARGE)
      else setUploadError(result.problem?.errors?.file?.[0] ?? problemMessage(result.problem, 'Фото не завантажено.'))
    } catch {
      setUploadError(NETWORK_ERROR)
    }
    setBusy(false)
  }

  const shownError = uploadError ?? error

  return (
    <div className="catalog-image-field" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="catalog-image-field-label">
        {label}
      </span>
      <div className="catalog-image-field-row">
        <div className={`catalog-image-field-preview is-${shape}`} aria-busy={busy || undefined}>
          {busy ? <Loader size="sm" color="gray" /> : value ? <img src={value} alt={alt} /> : fallback ?? <IconPhoto size={26} stroke={1.4} aria-hidden="true" />}
        </div>
        <div className="catalog-image-field-side">
          <Group gap={6}>
            <FileButton accept={ACCEPT} disabled={disabled || busy} onChange={(file) => void upload(file)}>
              {(props) => (
                <Button {...props} size="xs" variant="default" leftSection={<IconPhotoUp size={14} stroke={1.8} />} disabled={disabled || busy}>
                  {value ? 'Замінити' : 'Завантажити'}
                </Button>
              )}
            </FileButton>
            {value ? (
              <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} stroke={1.8} />} disabled={disabled || busy} onClick={() => onChange(null)}>
                Прибрати
              </Button>
            ) : null}
          </Group>
          <Text size="xs" c="dimmed">
            {description ?? 'JPEG, PNG або WebP.'} До 10 МБ.
          </Text>
          {shownError ? (
            <Text size="xs" c="red" role="alert">
              {shownError}
            </Text>
          ) : null}
        </div>
      </div>
    </div>
  )
}
