import { ActionIcon, Alert, Button, FileInput, Text, TextInput, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconArrowRight, IconPhotoUp, IconTrash, IconUpload } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { TableChip } from '@/shared/ui/TableChip'
import { deleteImage, reorderImages, uploadProductImage, type Product, type ProductImage } from '../api/catalogApi'
import { ProductImageAlt } from './ProductImageAlt'

type ProductEditorImagesProps = {
  product: Product
  readOnly: boolean
  onChange: (product: Product) => void
}

export function ProductEditorImages({ product, readOnly, onChange }: ProductEditorImagesProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState('')
  const [removing, setRemoving] = useState<ProductImage | null>(null)
  const images = product.images

  async function run(action: () => Promise<{ data?: Product; error?: unknown }>, fallback: string) {
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      if (result.data) onChange(result.data)
      else setError(problemMessage(result.error, fallback))
    } catch {
      setError(NETWORK_ERROR)
    }
    setBusy(false)
  }

  async function upload(event: FormEvent) {
    event.preventDefault()
    if (!file || file.size === 0) {
      setError('Оберіть файл фото.')
      return
    }
    setBusy(true)
    setError(null)
    const data = new FormData()
    data.set('file', file)
    if (alt.trim()) data.set('alt', alt.trim())
    try {
      const result = await uploadProductImage(product.id, data)
      if (result.data) {
        setFile(null)
        setAlt('')
        onChange(result.data)
      } else {
        setError(result.problem?.errors?.file?.[0] ?? (result.problem ? problemMessage(result.problem, 'Фото не завантажено.') : 'Фото не завантажено.'))
      }
    } catch {
      setError(NETWORK_ERROR)
    }
    setBusy(false)
  }

  function reorder(next: { id: string; alt: string }[]) {
    void run(() => withCsrf((headers) => reorderImages(headers, product.id, next)), 'Зміни фото не збережено.')
  }

  function move(index: number, delta: number) {
    const list = images.map((image) => ({ id: image.id, alt: image.alt }))
    const [item] = list.splice(index, 1)
    list.splice(index + delta, 0, item)
    reorder(list)
  }

  async function confirmRemove() {
    if (!removing) return
    const imageId = removing.id
    await run(() => withCsrf((headers) => deleteImage(headers, product.id, imageId)), 'Фото не видалено.')
    setRemoving(null)
  }

  return (
    <section className="catalog-card" aria-labelledby="images-title">
      <h2 id="images-title" className="app-section-title catalog-card-title">
        Фото
      </h2>
      {images.length > 0 ? (
        <ul className="catalog-images" aria-busy={busy || undefined}>
          {images.map((image, index) => (
            <li key={image.id} className="catalog-image">
              <div className="catalog-image-frame">
                <img src={image.url} alt={image.alt} loading="lazy" />
                {index === 0 ? (
                  <span className="catalog-image-main">
                    <TableChip tone="success" value="Головне фото" />
                  </span>
                ) : null}
              </div>
              {readOnly ? (
                <Text size="xs" c="dimmed" className="catalog-image-alt-text">
                  {image.alt}
                </Text>
              ) : (
                <>
                  <ProductImageAlt
                    key={`${image.id}:${image.alt}`}
                    id={image.id}
                    value={image.alt}
                    disabled={busy}
                    onSave={(text) => reorder(images.map((item) => ({ id: item.id, alt: item.id === image.id ? text : item.alt })))}
                  />
                  <div className="catalog-image-actions">
                    <Tooltip label="Раніше">
                      <ActionIcon variant="default" aria-label="Раніше" disabled={busy || index === 0} onClick={() => move(index, -1)}>
                        <IconArrowLeft size={16} stroke={1.7} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Пізніше">
                      <ActionIcon variant="default" aria-label="Пізніше" disabled={busy || index === images.length - 1} onClick={() => move(index, 1)}>
                        <IconArrowRight size={16} stroke={1.7} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Видалити">
                      <ActionIcon variant="subtle" color="red" ml="auto" aria-label="Видалити" disabled={busy} onClick={() => setRemoving(image)}>
                        <IconTrash size={16} stroke={1.7} />
                      </ActionIcon>
                    </Tooltip>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Text size="sm" c="dimmed">
          Фото ще немає. Вітрина показує заглушку «Фото додасть магазин».
        </Text>
      )}

      {readOnly ? null : (
        <form className="catalog-upload" onSubmit={upload} aria-label="Нове фото">
          <FileInput
            label="Нове фото (JPEG, PNG, WebP до 10 МБ)"
            placeholder="Оберіть файл"
            accept="image/jpeg,image/png,image/webp"
            leftSection={<IconPhotoUp size={16} stroke={1.7} />}
            clearable
            value={file}
            disabled={busy}
            onChange={(value) => {
              setFile(value)
              setError(null)
            }}
          />
          <TextInput label="Опис фото для незрячих" placeholder="Що на фото" maxLength={300} value={alt} disabled={busy} onChange={(event) => setAlt(event.currentTarget.value)} />
          <Button type="submit" variant="default" leftSection={<IconUpload size={16} stroke={1.7} />} loading={busy}>
            Завантажити фото
          </Button>
        </form>
      )}

      {error ? (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert" mt="sm">
          {error}
        </Alert>
      ) : null}

      <ConfirmDialog
        opened={removing !== null}
        title="Видалити фото"
        message="Фото зникне з товару й з вітрини. Скасувати видалення не можна."
        confirmLabel="Видалити фото"
        danger
        busy={busy}
        onConfirm={() => void confirmRemove()}
        onClose={() => setRemoving(null)}
      />
    </section>
  )
}
