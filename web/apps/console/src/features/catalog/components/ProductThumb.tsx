import { IconPhoto } from '@tabler/icons-react'
import { thumb } from '@polivalko/shared/lib/images'
import './catalog.css'

export function ProductThumb({ url, size = 36 }: { url: string | null | undefined; size?: number }) {
  if (!url) {
    return (
      <span className="catalog-thumb is-empty" style={{ width: size, height: size }} aria-hidden="true">
        <IconPhoto size={Math.round(size * 0.45)} stroke={1.5} />
      </span>
    )
  }
  return <img className="catalog-thumb" src={thumb(url, 120)} alt="" loading="lazy" width={size} height={size} />
}
