import { Button, FileButton, Input } from '@mantine/core'
import { IconPhoto, IconTrash, IconUpload } from '@tabler/icons-react'
import { useState } from 'react'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { uploadImage } from '../api/contentApi'

const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_BYTES = 10 * 1024 * 1024

type ImageFieldProps = {
  label: string
  description?: string
  value: string
  required?: boolean
  error?: string
  shape?: 'wide' | 'tall' | 'square'
  onChange: (url: string) => void
}

export function ImageField({ label, description, value, required = false, error, shape = 'wide', onChange }: ImageFieldProps) {
  const [busy, setBusy] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function upload(file: File | null) {
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type)) {
      setUploadError('Підходять фото JPEG, PNG або WebP.')
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadError('Фото завелике: до 10 МБ.')
      return
    }
    setBusy(true)
    setUploadError(null)
    try {
      const result = await uploadImage(file)
      if (result.data?.url) onChange(result.data.url)
      else setUploadError(result.error?.errors?.file?.[0] ?? problemMessage(result.error, 'Фото не завантажено.'))
    } catch {
      setUploadError(NETWORK_ERROR)
    }
    setBusy(false)
  }

  return (
    <Input.Wrapper label={label} description={description} required={required} error={uploadError ?? error}>
      <div className="content-image-field">
        <div className={`content-image-preview is-${shape}`} aria-busy={busy || undefined}>
          {value ? <img src={value} alt="" /> : <IconPhoto size={22} stroke={1.5} aria-hidden="true" />}
        </div>
        <div className="content-image-actions">
          <FileButton accept={ACCEPT} onChange={(file) => void upload(file)}>
            {(props) => (
              <Button {...props} variant="default" size="xs" loading={busy} leftSection={<IconUpload size={14} stroke={1.8} />}>
                {value ? 'Замінити фото' : 'Завантажити фото'}
              </Button>
            )}
          </FileButton>
          {value && !required ? (
            <Button variant="subtle" color="red" size="xs" disabled={busy} leftSection={<IconTrash size={14} stroke={1.8} />} onClick={() => onChange('')}>
              Прибрати
            </Button>
          ) : null}
          <span className="content-muted content-image-hint">JPEG, PNG або WebP, до 10 МБ.</span>
        </div>
      </div>
    </Input.Wrapper>
  )
}
