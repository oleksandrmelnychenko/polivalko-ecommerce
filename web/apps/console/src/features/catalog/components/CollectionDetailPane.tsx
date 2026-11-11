import { ActionIcon, Button, Tooltip } from '@mantine/core'
import { IconExternalLink, IconLayoutGrid, IconPencil } from '@tabler/icons-react'
import { plural } from '@polivalko/shared/lib/format'
import { siteUrl } from '@/shared/lib/siteUrl'
import { TableChip } from '@/shared/ui/TableChip'
import type { ConsoleCollection } from '../api/catalogApi'
import { PreviewCard, ProductTilesGrid } from './ProductPreviewGrid'

const countFormat = new Intl.NumberFormat('uk-UA')

type CollectionDetailPaneProps = {
  collection: ConsoleCollection | null
  position: number
  onEdit: (collection: ConsoleCollection) => void
}

export function CollectionDetailPane({ collection, position, onEdit }: CollectionDetailPaneProps) {
  if (!collection) return <section className="catalog-split-detail catalog-split-detail-empty">Оберіть добірку зліва.</section>

  const products = collection.products
  const inStock = products.filter((product) => product.stock > 0).length
  const hidden = products.filter((product) => !product.isVisible).length

  return (
    <section key={collection.id} className="catalog-split-detail" aria-labelledby="collection-detail-title">
      <header className="catalog-split-hero">
        <div className="catalog-split-hero-top">
          <div className="catalog-split-head">
            <span className="catalog-category-photo" aria-hidden="true">
              <IconLayoutGrid size={26} stroke={1.5} />
            </span>
            <div className="catalog-split-hero-main">
              <p className="catalog-split-hero-kicker catalog-split-mono">{collection.code}</p>
              <h2 id="collection-detail-title" className="catalog-category-title">
                {collection.title}
                {collection.isVisible ? <TableChip tone="success" dot value="На головній" /> : <TableChip value="Прихована" />}
              </h2>
              <p className="catalog-split-description">
                {!collection.isVisible
                  ? 'На головній не показується.'
                  : position === 0
                    ? 'Поки в добірці немає товарів, на головній її не видно.'
                    : position === 1
                      ? 'Перша на головній: велика секція з фото й стрічка товарів.'
                      : `На головній стрічкою товарів, позиція ${position}.`}
              </p>
            </div>
          </div>
          <div className="catalog-split-actions">
            <Button variant="default" size="sm" leftSection={<IconPencil size={16} stroke={1.7} />} onClick={() => onEdit(collection)}>
              Змінити
            </Button>
            {collection.isVisible ? (
              <Tooltip label="Головна сторінка сайту">
                <ActionIcon component="a" href={siteUrl('/')} target="_blank" rel="noopener" variant="subtle" color="gray" size="lg" aria-label="Відкрити головну сторінку сайту">
                  <IconExternalLink size={17} stroke={1.7} />
                </ActionIcon>
              </Tooltip>
            ) : null}
          </div>
        </div>

        <dl className="catalog-split-stats">
          <div>
            <dt>Товарів</dt>
            <dd>{countFormat.format(products.length)}</dd>
          </div>
          <div>
            <dt>В наявності</dt>
            <dd>
              {countFormat.format(inStock)}
              {products.length && inStock < products.length ? <small>немає {countFormat.format(products.length - inStock)}</small> : null}
            </dd>
          </div>
          <div>
            <dt>Приховані з сайту</dt>
            <dd>{countFormat.format(hidden)}</dd>
          </div>
        </dl>
      </header>

      <PreviewCard
        title="Товари добірки"
        aside={products.length ? <span>у порядку показу, {products.length} {plural(products.length, 'товар', 'товари', 'товарів')}</span> : null}
      >
        {products.length ? (
          <ProductTilesGrid items={products} />
        ) : (
          <p className="catalog-split-blank">У добірці ще немає товарів. Додати їх можна кнопкою «Змінити».</p>
        )}
      </PreviewCard>
    </section>
  )
}
