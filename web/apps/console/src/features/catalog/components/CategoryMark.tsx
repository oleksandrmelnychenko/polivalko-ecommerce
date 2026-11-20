import { thumb } from '@polivalko/shared/lib/images'
import type { Icon } from '@tabler/icons-react'
import type { ConsoleCategory } from '../api/catalogApi'
import { categoryIcon } from '../lib/categoryIcons'

export function CategoryGlyph({ icon: Glyph, size }: { icon: Icon; size: number }) {
  return <Glyph size={size} stroke={1.7} aria-hidden="true" />
}

export function CategoryMark({ category }: { category: ConsoleCategory }) {
  return (
    <span className="category-folder" aria-hidden="true">
      {category.imageUrl
        ? <img src={thumb(category.imageUrl, 120)} alt="" loading="lazy" />
        : <CategoryGlyph icon={categoryIcon(category.name, Boolean(category.parentId))} size={17} />}
    </span>
  )
}
