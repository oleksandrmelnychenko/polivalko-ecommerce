import { ActionIcon, Button, Tooltip } from '@mantine/core'
import { IconAdjustmentsHorizontal, IconChevronRight, IconExternalLink, IconFolders, IconPackage, IconPencil } from '@tabler/icons-react'
import { Fragment, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { siteUrl } from '@/shared/lib/siteUrl'
import { TableChip } from '@/shared/ui/TableChip'
import { MetricLabel, MetricTrack } from '@/shared/ui/MetricCard'
import type { ConsoleCategory } from '../api/catalogApi'
import type { AttributeDefinition } from '../api/dictionariesApi'
import { descendantIds, isHidden, MAX_CATEGORY_FILTERS, type OrderedCategory } from '../lib/categoryTree'
import { CategoryMark } from './CategoryMark'
import { ProductPreviewGrid } from './ProductPreviewGrid'

const countFormat = new Intl.NumberFormat('uk-UA')

type CategoryDetailPaneProps = {
  category: OrderedCategory | null
  all: ConsoleCategory[]
  attributes: AttributeDefinition[] | null
  onEdit: (category: ConsoleCategory, focusFilters?: boolean) => void
  onSelect: (id: string) => void
}

export function CategoryDetailPane({ category, all, attributes, onEdit, onSelect }: CategoryDetailPaneProps) {
  if (!category) return null
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
  const visibleChildren = hidden ? 0 : children.filter((child) => child.isVisible).length

  return (
    <section className="app-split-detail" aria-labelledby="category-detail-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <CategoryMark category={category} />
            <div className="app-split-hero-main">
              {ancestors.length > 0 && (
                <p className="app-split-hero-kicker catalog-category-path">
                  {ancestors.map((item, index) => (
                    <Fragment key={item.id}>
                      {index > 0 ? ' / ' : null}
                      <button type="button" onClick={() => onSelect(item.id)}>
                        {item.name}
                      </button>
                    </Fragment>
                  ))}
                </p>
              )}
              <h2 id="category-detail-title" className="catalog-category-title">
                {category.name}
                {hidden ? <TableChip value={category.isVisible ? 'прихована батьківська' : 'прихована'} /> : null}
              </h2>
              {category.description ? <p className="app-split-description">{category.description}</p> : null}
            </div>
          </div>
          <div className="app-split-actions">
            <Button className="category-edit" variant="default" size="sm" aria-label="Змінити" leftSection={<IconPencil size={16} stroke={1.7} />} onClick={() => onEdit(category)}>
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

      </header>
      <dl className="catalog-metrics">
        <div>
          <dt><MetricLabel icon={IconPackage}>Товарів{children.length > 0 ? ' загалом' : ''}</MetricLabel></dt>
          <dd>
            <strong>{countFormat.format(totalProducts)}</strong>
            <small>
              {children.length ? <>{countFormat.format(category.productCount)} у самій категорії<br />{countFormat.format(totalProducts - category.productCount)} у підкатегоріях</> : 'У самій категорії'}
            </small>
            <MetricTrack value={category.productCount} max={totalProducts} />
          </dd>
        </div>
        <div>
          <dt><MetricLabel icon={IconFolders}>Підкатегорій</MetricLabel></dt>
          <dd>
            <strong>{countFormat.format(children.length)}</strong>
            <small>На сайті · {countFormat.format(visibleChildren)}</small>
            <MetricTrack value={visibleChildren} max={children.length} />
          </dd>
        </div>
        <div>
          <dt><MetricLabel icon={IconAdjustmentsHorizontal}>Фільтрів на сайті</MetricLabel></dt>
          <dd>
            <strong>{countFormat.format(filters.length)}</strong>
            <small>{inheritedFrom ? 'Успадковано' : 'Налаштовано'} · {filters.length} з {MAX_CATEGORY_FILTERS}</small>
            <MetricTrack value={filters.length} max={MAX_CATEGORY_FILTERS} />
          </dd>
        </div>
      </dl>

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
          <div className="category-filter-setup">
            <p>Оберіть характеристики, за якими покупці зможуть відбирати товари на сайті.</p>
            <Button variant="default" size="xs" leftSection={<IconAdjustmentsHorizontal size={15} />} onClick={() => onEdit(category, true)}>
              Налаштувати фільтри
            </Button>
          </div>
        )}
      </section>

      {children.length ? (
        <section className="app-split-card" aria-labelledby="category-children-title">
          <header className="app-split-card-head">
            <h3 id="category-children-title">Підкатегорії</h3>
            <span>Товарів</span>
          </header>
          <ul className="category-children">
            {children.map((child) => (
              <li key={child.id} className={child.isVisible ? 'is-link' : 'is-link is-muted'}>
                <button type="button" onClick={() => onSelect(child.id)}>
                  <span>{child.name}</span>
                  <span className="category-child-count">{countFormat.format(child.productCount)}</span>
                  <IconChevronRight size={15} aria-hidden="true" />
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
