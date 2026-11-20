import { ActionIcon } from '@mantine/core'
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react'
import { AppModal } from '@/shared/ui/AppModal'
import type { ProductImage } from '../api/catalogApi'

type Props = {
  images: ProductImage[]
  index: number
  productName: string
  onSelect: (id: string) => void
  onClose: () => void
}

export function ProductPhotoViewer({ images, index, productName, onSelect, onClose }: Props) {
  const photo = images[index]
  const multiple = images.length > 1

  function step(direction: number) {
    onSelect(images[(index + direction + images.length) % images.length].id)
  }

  return (
    <AppModal opened title="Перегляд фото" size="min(880px, 100%)" className="product-photo-viewer"
      closeButtonProps={{ 'aria-label': 'Закрити фото' }} onClose={onClose}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        } else if (multiple && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
          event.preventDefault()
          step(event.key === 'ArrowRight' ? 1 : -1)
        }
      }}>
      <figure>
        <img key={photo.id} src={photo.url} alt={photo.alt || productName} />
        {photo.alt && <figcaption>{photo.alt}</figcaption>}
      </figure>
      {multiple && (
        <div className="product-photo-navigation">
          <ActionIcon size="lg" radius="xl" variant="default" aria-label="Попереднє фото" onClick={() => step(-1)}><IconArrowLeft size={17} /></ActionIcon>
          <span aria-live="polite">{index + 1} / {images.length}</span>
          <ActionIcon size="lg" radius="xl" variant="default" aria-label="Наступне фото" onClick={() => step(1)}><IconArrowRight size={17} /></ActionIcon>
        </div>
      )}
    </AppModal>
  )
}
