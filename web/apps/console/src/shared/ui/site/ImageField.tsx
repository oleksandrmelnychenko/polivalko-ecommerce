import { Button, FileButton, Input } from '@mantine/core'
import { IconPhoto, IconTrash, IconUpload } from '@tabler/icons-react'
import { useId, useState } from 'react'
import { NETWORK_ERROR, problemMessage, type Problem } from '@/shared/api/problem'
import './image-field.css'

const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_BYTES = 10 * 1024 * 1024

type ImageFieldProps = {
  label: string
  uploadImage: (file: File) => Promise<{ data?: { url: string }; error?: Problem }>
  description?: string
  value: string
  required?: boolean
  error?: string
  shape?: 'wide' | 'tall' | 'square'
  onChange: (url: string) => void
  disabled?: boolean
  onUploading?: (busy: boolean) => void
}

export function ImageField({ label, uploadImage, description, value, required = false, error, shape = 'wide', disabled, onUploading, onChange }: ImageFieldProps) {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function upload(file: File | null) {
    if (!file || busy || disabled) return
    if (!ACCEPT.split(',').includes(file.type)) {
      setUploadError('Підходять фото JPEG, PNG або WebP.')
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadError('Фото завелике: до 10 МБ.')
      return
    }
    setBusy(true)
    onUploading?.(true)
    setUploadError(null)
    try {
      const result = await uploadImage(file)
      if (result.data?.url) onChange(result.data.url)
      else setUploadError(result.error?.errors?.file?.[0] ?? problemMessage(result.error, 'Фото не завантажено.'))
    } catch {
      setUploadError(NETWORK_ERROR)
    } finally {
      setBusy(false)
      onUploading?.(false)
    }
  }

  return (
    <Input.Wrapper id={id} label={label} description={description} required={required} error={uploadError ?? error}>
      <div className="site-image-field">
        <div className={`site-image-preview is-${shape}`} aria-busy={busy || undefined}>
          {value ? <img src={value} alt="" /> : <IconPhoto size={22} stroke={1.5} aria-hidden="true" />}
        </div>
        <div className="site-image-actions">
          <FileButton accept={ACCEPT} onChange={(file) => void upload(file)}>
            {(props) => (
              <Button {...props} id={id} aria-label={`${value ? 'Замінити' : 'Завантажити'}: ${label}`} variant="default" size="xs" loading={busy} disabled={disabled} aria-invalid={Boolean(uploadError || error) || undefined} leftSection={<IconUpload size={14} stroke={1.8} />}>
                {value ? 'Замінити фото' : 'Завантажити фото'}
              </Button>
            )}
          </FileButton>
          {value && !required ? (
            <Button variant="subtle" color="red" size="xs" disabled={busy || disabled} leftSection={<IconTrash size={14} stroke={1.8} />} onClick={() => onChange('')}>
              Прибрати
            </Button>
          ) : null}
          <span className="site-image-hint">JPEG, PNG або WebP, до 10 МБ.</span>
        </div>
      </div>
    </Input.Wrapper>
  )
}
