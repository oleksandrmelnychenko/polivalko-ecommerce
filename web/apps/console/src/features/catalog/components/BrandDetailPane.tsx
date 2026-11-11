import { ActionIcon, Button, Tooltip } from '@mantine/core'
import { IconArrowMerge, IconExternalLink, IconPencil } from '@tabler/icons-react'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { siteUrl } from '@/shared/lib/siteUrl'
import { getProducts } from '../api/catalogApi'
import type { Brand } from '../api/dictionariesApi'
import { BrandMark } from './BrandMark'
import { ProductPreviewGrid } from './ProductPreviewGrid'

const countFormat = new Intl.NumberFormat('uk-UA')
const percentFormat = new Intl.NumberFormat('uk-UA', { style: 'percent', maximumFractionDigits: 0 })

type BrandDetailPaneProps = {
  brand: Brand | null
  totalProducts: number | null
  onEdit: (brand: Brand) => void
  onMerge: (brand: Brand) => void
}

function share(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) return percentFormat.format(0)
  const value = part / whole
  return value < 0.01 ? `<${percentFormat.format(0.01)}` : percentFormat.format(value)
}

export function BrandDetailPane({ brand, totalProducts, onEdit, onMerge }: BrandDetailPaneProps) {
  if (!brand) return <section className="catalog-split-detail catalog-split-detail-empty">Оберіть бренд зліва.</section>
  return <BrandDetail key={brand.id} brand={brand} totalProducts={totalProducts} onEdit={onEdit} onMerge={onMerge} />
}

function BrandDetail({ brand, totalProducts, onEdit, onMerge }: BrandDetailPaneProps & { brand: Brand }) {
  const hasProducts = brand.productCount > 0
  const inStock = useApiQuery(`catalog-brand-in-stock:${brand.name}`, () => getProducts({ brand: brand.name, stock: 'in', page: 1, pageSize: 1 }), { enabled: hasProducts })
  const noPhoto = useApiQuery(`catalog-brand-no-photo:${brand.name}`, () => getProducts({ brand: brand.name, fill: 'missing-photo', page: 1, pageSize: 1 }), {
    enabled: hasProducts,
  })
  const productsLink = `/catalog/products?brand=${encodeURIComponent(brand.name)}`
  const count = (query: typeof inStock) => (!hasProducts ? '0' : query.data ? countFormat.format(query.data.totalItems) : '·')

  return (
    <section className="catalog-split-detail" aria-labelledby="brand-detail-title">
      <header className="catalog-split-hero">
        <div className="catalog-split-hero-top">
          <div className="catalog-split-head">
            <BrandMark name={brand.name} logoUrl={brand.logoUrl} size="lg" />
            <div className="catalog-split-hero-main">
              <p className="catalog-split-hero-kicker catalog-split-mono">/{brand.slug}</p>
              <h2 id="brand-detail-title">{brand.name}</h2>
              {brand.description ? (
                <p className="catalog-split-description">{brand.description}</p>
              ) : (
                <p className="catalog-split-hero-aliases">Опису й логотипа ще немає.</p>
              )}
            </div>
          </div>
          <div className="catalog-split-actions">
            <Button variant="default" size="sm" leftSection={<IconPencil size={16} stroke={1.7} />} onClick={() => onEdit(brand)}>
              Змінити
            </Button>
            <Button variant="subtle" color="gray" size="sm" leftSection={<IconArrowMerge size={16} stroke={1.7} />} onClick={() => onMerge(brand)}>
              Об&apos;єднати з…
            </Button>
            {hasProducts ? (
              <Tooltip label="Товари бренду на сайті">
                <ActionIcon
                  component="a"
                  href={siteUrl(`/catalog?brand=${encodeURIComponent(brand.name)}`)}
                  target="_blank"
                  rel="noopener"
                  variant="subtle"
                  color="gray"
                  size="lg"
                  aria-label={`Товари «${brand.name}» на сайті`}
                >
                  <IconExternalLink size={17} stroke={1.7} />
                </ActionIcon>
              </Tooltip>
            ) : null}
          </div>
        </div>

        <dl className="catalog-split-stats">
          <div>
            <dt>Товарів</dt>
            <dd>
              {countFormat.format(brand.productCount)}
              {totalProducts && hasProducts ? <small>{share(brand.productCount, totalProducts)} каталогу</small> : null}
            </dd>
          </div>
          <div>
            <dt>В наявності</dt>
            <dd>{count(inStock)}</dd>
          </div>
          <div>
            <dt>Без фото</dt>
            <dd>{count(noPhoto)}</dd>
          </div>
        </dl>
      </header>

      <ProductPreviewGrid
        title="Товари бренду"
        cacheKey={`catalog-brand-preview:${brand.name}`}
        filter={{ brand: brand.name }}
        listHref={productsLink}
        enabled={hasProducts}
        emptyText="У бренду ще немає товарів. Його можна видалити або об'єднати з іншим."
      />
    </section>
  )
}
