import { ActionIcon, Button, Tooltip } from '@mantine/core'
import { IconCategory, IconExternalLink, IconPencil } from '@tabler/icons-react'
import { Fragment, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { plural } from '@polivalko/shared/lib/format'
import { siteUrl } from '@/shared/lib/siteUrl'
import { TableChip } from '@/shared/ui/TableChip'
import type { ConsoleCategory } from '../api/catalogApi'
import type { AttributeDefinition } from '../api/dictionariesApi'
import { descendantIds, isHidden, type OrderedCategory } from '../lib/categoryTree'
import { ProductPreviewGrid } from './ProductPreviewGrid'

const countFormat = new Intl.NumberFormat('uk-UA')

type CategoryDetailPaneProps = {
  category: OrderedCategory | null
  all: ConsoleCategory[]
  attributes: AttributeDefinition[] | null
  onEdit: (category: ConsoleCategory) => void
  onSelect: (id: string) => void
}

export function CategoryDetailPane({ category, all, attributes, onEdit, onSelect }: CategoryDetailPaneProps) {
  if (!category) return <section className="app-split-detail app-split-detail-empty">Оберіть категорію зліва.</section>
  return <CategoryDetail key={category.id} category={category} all={all} attributes={attributes} onEdit={onEdit} onSelect={onSelect} />
}

function CategoryDetail({ category, all, attributes, onEdit, onSelect }: CategoryDetailPaneProps & { category: OrderedCategory }) {
  const byId = useMemo(() => new Map(all.map((item) => [item.id, item])), [all])
  const ancestors = useMemo(() => {
    const chain: ConsoleCategory[] = []
    for (let parent = category.parentId ? byId.get(category.parentId) : undefined; parent && chain.length < 10; parent = parent.parentId ? byId.get(parent.parentId) : undefined) {
      chain.unshift(parent)
    }
    return chain
  }, [byId, category.parentId])
  const children = useMemo(() => all.filter((item) => item.parentId === category.id).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'uk')), [all, category.id])
  const totalProducts = useMemo(() => {
    const ids = descendantIds(all, category.id)
    return all.reduce((sum, item) => (ids.has(item.id) ? sum + item.productCount : sum), 0)
  }, [all, category.id])
  const inheritedFrom = category.filterAttributes.length ? null : [...ancestors].reverse().find((item) => item.filterAttributes.length > 0) ?? null
  const filters = category.filterAttributes.length ? category.filterAttributes : (inheritedFrom?.filterAttributes ?? [])
  const attributeIds = useMemo(() => new Map((attributes ?? []).map((item) => [item.name.toUpperCase(), item.id])), [attributes])
  const hidden = isHidden(category)

  return (
    <section className="app-split-detail" aria-labelledby="category-detail-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <span className="catalog-category-photo" aria-hidden="true">
              {category.imageUrl ? <img src={category.imageUrl} alt="" loading="lazy" /> : <IconCategory size={26} stroke={1.5} />}
            </span>
            <div className="app-split-hero-main">
              <p className="app-split-hero-kicker catalog-category-path">
                {ancestors.length ? (
                  ancestors.map((item, index) => (
                    <Fragment key={item.id}>
                      {index > 0 ? ' / ' : null}
                      <button type="button" onClick={() => onSelect(item.id)}>
                        {item.name}
                      </button>
                    </Fragment>
                  ))
                ) : (
                  'Розділ каталогу'
                )}
              </p>
              <h2 id="category-detail-title" className="catalog-category-title">
                {category.name}
                {hidden ? <TableChip value={category.isVisible ? 'прихована батьківська' : 'прихована'} /> : null}
              </h2>
              <p className="app-split-hero-aliases catalog-category-meta">
                <span className="app-split-mono">/catalog/{category.slug}</span>
                <span>{category.navkoloRef ? `Група Navkolo: ${category.navkoloRef}` : 'Група Navkolo не задана'}</span>
              </p>
              {category.description ? <p className="app-split-description">{category.description}</p> : null}
            </div>
          </div>
          <div className="app-split-actions">
            <Button variant="default" size="sm" leftSection={<IconPencil size={16} stroke={1.7} />} onClick={() => onEdit(category)}>
              Змінити
            </Button>
            {hidden ? null : (
              <Tooltip label="Категорія на сайті">
                <ActionIcon
                  component="a"
                  href={siteUrl(`/catalog/${category.slug}`)}
                  target="_blank"
                  rel="noopener"
                  variant="subtle"
                  color="gray"
                  size="lg"
                  aria-label={`Відкрити «${category.name}» на сайті`}
                >
                  <IconExternalLink size={17} stroke={1.7} />
                </ActionIcon>
              </Tooltip>
            )}
          </div>
        </div>

        <dl className="app-split-stats">
          <div>
            <dt>Товарів</dt>
            <dd>
              {countFormat.format(totalProducts)}
              {children.length && totalProducts !== category.productCount ? <small>напряму {countFormat.format(category.productCount)}</small> : null}
            </dd>
          </div>
          <div>
            <dt>Підкатегорій</dt>
            <dd>{countFormat.format(children.length)}</dd>
          </div>
          <div>
            <dt>Фільтрів на сайті</dt>
            <dd>
              {countFormat.format(filters.length)}
              {inheritedFrom ? <small>успадковано</small> : null}
            </dd>
          </div>
        </dl>
      </header>

      <section className="app-split-card" aria-labelledby="category-filters-title">
        <header className="app-split-card-head">
          <h3 id="category-filters-title">Фільтри на сайті</h3>
          {inheritedFrom ? (
            <span>
              від «
              <button type="button" className="catalog-category-inline" onClick={() => onSelect(inheritedFrom.id)}>
                {inheritedFrom.name}
              </button>
              »
            </span>
          ) : null}
        </header>
        {filters.length ? (
          <ul className="app-split-tags">
            {filters.map((name) => {
              const id = attributeIds.get(name.toUpperCase())
              return id ? (
                <li key={name} className="is-link">
                  <Link to={`/catalog/attributes?id=${id}`}>
                    <span className="app-split-tag-name">{name}</span>
                  </Link>
                </li>
              ) : (
                <li key={name}>
                  <span className="app-split-tag-name">{name}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="app-split-blank">Фільтрів немає ні тут, ні в батьківських категоріях. Додати можна кнопкою «Змінити».</p>
        )}
      </section>

      {children.length ? (
        <section className="app-split-card" aria-labelledby="category-children-title">
          <header className="app-split-card-head">
            <h3 id="category-children-title">Підкатегорії</h3>
            <span>
              {children.length} {plural(children.length, 'підкатегорія', 'підкатегорії', 'підкатегорій')}
            </span>
          </header>
          <ul className="app-split-tags">
            {children.map((child) => (
              <li key={child.id} className={child.isVisible ? 'is-link' : 'is-link is-muted'}>
                <button type="button" onClick={() => onSelect(child.id)}>
                  <span className="app-split-tag-name">{child.name}</span>
                  <span className="app-split-tag-count">{countFormat.format(child.productCount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {category.productCount > 0 || children.length === 0 ? (
        <ProductPreviewGrid
          title="Товари категорії"
          cacheKey={`catalog-category-preview:${category.id}`}
          filter={{ categoryId: category.id }}
          listHref={`/catalog/products?categoryId=${encodeURIComponent(category.id)}`}
          enabled={category.productCount > 0}
          emptyText="У категорії ще немає товарів."
        />
      ) : null}
    </section>
  )
}
