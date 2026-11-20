import { ActionIcon, Button, Tooltip } from '@mantine/core'
import { IconPackage, IconBox, IconEyeOff, IconExternalLink, IconLayoutGrid, IconPencil } from '@tabler/icons-react'
import { plural } from '@polivalko/shared/lib/format'
import { siteUrl } from '@/shared/lib/siteUrl'
import { TableChip } from '@/shared/ui/TableChip'
import type { ConsoleCollection } from '../api/catalogApi'
import { PreviewCard, ProductTilesGrid } from './ProductPreviewGrid'
import { DictionaryMetric } from './DictionaryLayout'

const countFormat = new Intl.NumberFormat('uk-UA')

type CollectionDetailPaneProps = {
  collection: ConsoleCollection | null
  position: number
  onEdit: (collection: ConsoleCollection) => void
}

export function CollectionDetailPane({ collection, position, onEdit }: CollectionDetailPaneProps) {
  if (!collection) return <section className="app-split-detail app-split-detail-empty">Оберіть колекцію зліва.</section>

  const products = collection.products
  const inStock = products.filter((product) => product.stock > 0).length
  const hidden = products.filter((product) => !product.isVisible).length

  return (
    <section key={collection.id} className="app-split-detail" aria-labelledby="collection-detail-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <span className="app-split-kind-icon" aria-hidden="true">
              <IconLayoutGrid size={17} stroke={1.5} />
            </span>
            <div className="app-split-hero-main">
              <h2 id="collection-detail-title" className="catalog-category-title">
                {collection.title}
                {collection.isVisible ? <TableChip tone="success" dot value="На головній" /> : <TableChip value="Прихована" />}
              </h2>
              <p className="app-split-description">
                {!collection.isVisible
                  ? 'На головній не показується.'
                  : position === 0
                    ? 'Поки в колекції немає товарів, на головній її не видно.'
                    : position === 1
                      ? 'Перша на головній: велика секція з фото й стрічка товарів.'
                      : `На головній стрічкою товарів, позиція ${position}.`}
              </p>
            </div>
          </div>
          <div className="app-split-actions">
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
      </header>

      <dl className="catalog-metrics">
        <DictionaryMetric icon={IconPackage} label="Товарів у колекції" value={countFormat.format(products.length)} />
        <DictionaryMetric icon={IconBox} label="У наявності" value={countFormat.format(inStock)} part={inStock} total={products.length} />
        <DictionaryMetric icon={IconEyeOff} label="Приховані на сайті" value={countFormat.format(hidden)} part={hidden} total={products.length} />
      </dl>

      <PreviewCard
        title="Товари колекції"
        aside={products.length ? <span>у порядку показу, {products.length} {plural(products.length, 'товар', 'товари', 'товарів')}</span> : null}
      >
        {products.length ? (
          <ProductTilesGrid items={products} />
        ) : (
          <p className="app-split-blank">У колекції ще немає товарів. Додати їх можна кнопкою «Змінити».</p>
        )}
      </PreviewCard>
    </section>
  )
}
