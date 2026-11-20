import { ProductSectionTitle } from './ProductSectionTitle'
import { ActionIcon, Alert, Button, Loader, Text, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconArrowRight, IconCheck, IconPhotoOff, IconPhoto, IconStar, IconTrash, IconUpload } from '@tabler/icons-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { deleteImage, reorderImages, uploadProductImage, type Product, type ProductImage } from '../api/catalogApi'
import { ProductImageAlt } from './ProductImageAlt'

const MAX_IMAGES = 20
const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

type UploadState = 'waiting' | 'uploading' | 'done' | 'failed'

type UploadItem = {
  key: string
  name: string
  preview: string | null
  state: UploadState
  queued: boolean
  error?: string
}

type ProductEditorImagesProps = {
  product: Product
  readOnly: boolean
  disabled: boolean
  onBusy: (busy: boolean) => void
  onChange: (product: Product) => void
}

export function ProductEditorImages({ product, readOnly, disabled, onBusy, onChange }: ProductEditorImagesProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<ProductImage | null>(null)
  const [queue, setQueue] = useState<UploadItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const previews = useRef(new Set<string>())
  const images = product.images
  const free = Math.max(0, MAX_IMAGES - images.length)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIndex = Math.max(0, images.findIndex((image) => image.id === selectedId))
  const selected = images[selectedIndex]
  const locked = busy || uploading || disabled

  useEffect(() => {
    onBusy(busy || uploading)
    return () => onBusy(false)
  }, [busy, uploading, onBusy])

  useEffect(() => {
    const urls = previews.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])

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

  function patch(key: string, next: Partial<UploadItem>) {
    setQueue((current) => current.map((item) => (item.key === key ? { ...item, ...next } : item)))
  }

  function release(items: UploadItem[]) {
    for (const item of items) {
      if (!item.preview) continue
      URL.revokeObjectURL(item.preview)
      previews.current.delete(item.preview)
    }
  }

  async function addFiles(files: File[]) {
    if (locked || readOnly || files.length === 0) return
    setError(null)
    release(queue)
    const stamp = Date.now()
    const items: UploadItem[] = []
    const accepted: { key: string; file: File }[] = []
    files.forEach((file, index) => {
      const key = `${stamp}-${index}`
      let problem: string | undefined
      if (!ACCEPTED.includes(file.type)) problem = 'Це не JPEG, PNG чи WebP.'
      else if (file.size === 0) problem = 'Файл порожній.'
      else if (file.size > MAX_BYTES) problem = 'Файл більший за 10 МБ.'
      else if (accepted.length >= free) problem = `Більше ${MAX_IMAGES} фото в товару не можна.`
      const preview = problem ? null : URL.createObjectURL(file)
      if (preview) previews.current.add(preview)
      items.push({ key, name: file.name, preview, state: problem ? 'failed' : 'waiting', queued: !problem, error: problem })
      if (!problem) accepted.push({ key, file })
    })
    setQueue(items)
    if (accepted.length === 0) return

    setUploading(true)
    for (const { key, file } of accepted) {
      patch(key, { state: 'uploading' })
      const data = new FormData()
      data.set('file', file)
      try {
        const result = await uploadProductImage(product.id, data)
        if (result.data) {
          onChange(result.data)
          patch(key, { state: 'done' })
        } else {
          const message = result.problem?.errors?.file?.[0] ?? (result.problem ? problemMessage(result.problem, 'Фото не завантажено.') : 'Фото не завантажено.')
          patch(key, { state: 'failed', error: message })
        }
      } catch {
        patch(key, { state: 'failed', error: NETWORK_ERROR })
      }
    }
    setUploading(false)
    setQueue((current) => {
      release(current.filter((item) => item.state === 'done'))
      return current.filter((item) => item.state !== 'done')
    })
  }

  function clearQueue() {
    release(queue)
    setQueue([])
  }

  function dragOver(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = locked || free === 0 ? 'none' : 'copy'
    setDragging(true)
  }

  function dragLeave(event: DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
  }

  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setDragging(false)
    if (readOnly || locked || free === 0) return
    void addFiles(Array.from(event.dataTransfer.files))
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

  const total = queue.filter((item) => item.queued).length
  const processed = queue.filter((item) => item.queued && (item.state === 'done' || item.state === 'failed')).length
  const failed = queue.filter((item) => item.state === 'failed').length

  return (
    <section
      className="catalog-card product-gallery"
      aria-labelledby="images-title"
      data-dragging={dragging && !readOnly && !locked && free > 0 || undefined}
      onDragEnter={dragOver} onDragOver={dragOver} onDragLeave={dragLeave} onDrop={drop}
    >
      <div className="catalog-card-head">
        <ProductSectionTitle id="images-title" icon={IconPhoto} count={`${images.length}/${MAX_IMAGES}`}>Фото</ProductSectionTitle>
        {!readOnly && (
          <Button size="xs" variant="default" leftSection={<IconUpload size={15} />}
            loading={uploading} disabled={locked || free === 0} onClick={() => input.current?.click()}>
            Додати фото
          </Button>
        )}
      </div>
      {!readOnly && <input ref={input} type="file" accept={ACCEPTED.join(',')} multiple hidden
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          void addFiles(files)
        }}
      />}
      {images.length > 0 && (
        <ul className="catalog-images" aria-label="Фотографії товару" aria-busy={locked}>
          {images.map((image, index) => (
            <li key={image.id}>
              <button type="button" className="catalog-image-frame"
                aria-label={`Фото ${index + 1}${index === 0 ? ', головне' : ''}`}
                aria-pressed={selected?.id === image.id} onClick={() => setSelectedId(image.id)}>
                <img src={image.url} alt={image.alt} loading="lazy" />
                {index === 0 && <span className="catalog-image-main"><IconStar size={12} fill="currentColor" /></span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && !readOnly && (
        <div className="catalog-image-actions">
          <ProductImageAlt key={`${selected.id}:${selected.alt}`} id={selected.id} value={selected.alt} disabled={locked}
            onSave={(text) => reorder(images.map((item) => ({ id: item.id, alt: item.id === selected.id ? text : item.alt })))} />
          <Tooltip label="Зробити головним">
            <ActionIcon variant="default" aria-label="Зробити головним" disabled={locked || selectedIndex === 0}
              onClick={() => move(selectedIndex, -selectedIndex)}><IconStar size={16} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Раніше">
            <ActionIcon variant="default" aria-label="Раніше" disabled={locked || selectedIndex === 0}
              onClick={() => move(selectedIndex, -1)}><IconArrowLeft size={16} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Пізніше">
            <ActionIcon variant="default" aria-label="Пізніше" disabled={locked || selectedIndex === images.length - 1}
              onClick={() => move(selectedIndex, 1)}><IconArrowRight size={16} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Видалити фото">
            <ActionIcon variant="subtle" color="red" aria-label="Видалити фото" disabled={locked}
              onClick={() => setRemoving(selected)}><IconTrash size={16} /></ActionIcon>
          </Tooltip>
        </div>
      )}
      {!readOnly ? (
        <Text size="xs" c="dimmed" mt={6}>
          {free === 0 ? 'Додано всі 20 фото.' : dragging ? 'Відпустіть файли тут.' : 'Оберіть або перетягніть кілька фото. JPEG, PNG чи WebP до 10 МБ кожне.'}
        </Text>
      ) : !selected && <Text size="sm" c="dimmed">Фото ще немає.</Text>}

      {queue.length > 0 ? (
        <div className="catalog-queue" aria-live="polite">
          <div className="catalog-queue-head">
            <span>
              {uploading
                ? `Завантажується ${Math.min(processed + 1, total)} з ${total}`
                : failed > 0
                  ? `Не завантажено: ${failed}`
                  : 'Готово'}
            </span>
            {!uploading ? (
              <Button variant="subtle" size="compact-xs" onClick={clearQueue}>
                Сховати
              </Button>
            ) : null}
          </div>
          <ul>
            {queue.map((item) => (
              <li key={item.key} data-state={item.state}>
                {item.preview ? (
                  <img src={item.preview} alt="" />
                ) : (
                  <span className="catalog-queue-placeholder" aria-hidden="true">
                    <IconPhotoOff size={16} stroke={1.6} />
                  </span>
                )}
                <span className="catalog-queue-name">{item.name}</span>
                <span className="catalog-queue-state">
                  {item.state === 'waiting' ? 'У черзі' : null}
                  {item.state === 'uploading' ? (
                    <>
                      <Loader size={14} color="brand" /> Завантажується
                    </>
                  ) : null}
                  {item.state === 'done' ? (
                    <>
                      <IconCheck size={15} stroke={2} /> Додано
                    </>
                  ) : null}
                  {item.state === 'failed' ? item.error : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
