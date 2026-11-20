import { thumb } from '@polivalko/shared/lib/images'
import type { ConsoleCategory } from '../api/catalogApi'
import { categoryIcon } from '../lib/categoryIcons'

export function CategoryMark({ category }: { category: ConsoleCategory }) {
  const Glyph = categoryIcon(category.name, Boolean(category.parentId))
  return (
    <span className="category-folder" aria-hidden="true">
      {category.imageUrl
        ? <img src={thumb(category.imageUrl, 120)} alt="" loading="lazy" />
        : <Glyph size={17} stroke={1.7} />}
    </span>
  )
}
