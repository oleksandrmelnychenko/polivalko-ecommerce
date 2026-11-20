import type { Icon } from '@tabler/icons-react'
import type { ReactNode } from 'react'

export function CatalogSectionTitle({ id, icon: Glyph, children, count }: {
  id: string
  icon: Icon
  children: ReactNode
  count?: string
}) {
  return (
    <h2 id={id} className="catalog-section-title">
      <Glyph size={16} stroke={1.7} aria-hidden="true" />
      <span>{children}<i aria-hidden="true" /></span>
      {count && <small>{count}</small>}
    </h2>
  )
}
