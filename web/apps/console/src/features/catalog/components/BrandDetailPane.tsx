import { Button } from '@mantine/core'
import { IconPackage, IconBox, IconPhotoOff, IconArrowMerge, IconExternalLink, IconPencil } from '@tabler/icons-react'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { siteUrl } from '@/shared/lib/siteUrl'
import { getProducts } from '../api/catalogApi'
import type { Brand } from '../api/dictionariesApi'
import { BrandMark } from './BrandMark'
import { ProductPreviewGrid } from './ProductPreviewGrid'
import { DictionaryMetric } from './DictionaryLayout'

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
  if (!brand) return <section className="app-split-detail app-split-detail-empty">Оберіть бренд зліва.</section>
  return <BrandDetail key={brand.id} brand={brand} totalProducts={totalProducts} onEdit={onEdit} onMerge={onMerge} />
}

function BrandDetail({ brand, totalProducts, onEdit, onMerge }: BrandDetailPaneProps & { brand: Brand }) {
  const hasProducts = brand.productCount > 0
  const inStock = useApiQuery(`catalog-brand-in-stock:${brand.name}`, () => getProducts({ brand: brand.name, stock: 'in', page: 1, pageSize: 1 }), { enabled: hasProducts })
  const noPhoto = useApiQuery(`catalog-brand-no-photo:${brand.name}`, () => getProducts({ brand: brand.name, fill: 'missing-photo', page: 1, pageSize: 1 }), {
    enabled: hasProducts,
  })
  const productsLink = `/catalog/products?brand=${encodeURIComponent(brand.name)}`
  const count = (query: typeof inStock) => {
    if (!hasProducts) return '0'
    if (query.status === 'forbidden') return <span className="app-split-value-empty">немає доступу</span>
    if (query.status === 'error') return <span className="app-split-value-empty">не завантажено</span>
    return query.data ? countFormat.format(query.data.totalItems) : '·'
  }

  return (
    <section className="app-split-detail" aria-labelledby="brand-detail-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <BrandMark name={brand.name} logoUrl={brand.logoUrl} />
            <div className="app-split-hero-main">
              <h2 id="brand-detail-title">{brand.name}</h2>
              {brand.description && <p className="app-split-description">{brand.description}</p>}
            </div>
          </div>
          <div className="app-split-actions">
            <Button variant="default" size="sm" leftSection={<IconPencil size={16} stroke={1.7} />} onClick={() => onEdit(brand)}>
              Змінити
            </Button>
            <Button variant="subtle" color="gray" size="sm" leftSection={<IconArrowMerge size={16} stroke={1.7} />} onClick={() => onMerge(brand)}>
              Об&apos;єднати з…
            </Button>
            {hasProducts ? (
              <Button component="a" href={siteUrl(`/catalog?brand=${encodeURIComponent(brand.name)}`)} target="_blank" rel="noopener" variant="default" size="sm" leftSection={<IconExternalLink size={16} stroke={1.7} />}>
                На сайті
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <dl className="catalog-metrics">
        <DictionaryMetric icon={IconPackage} label="Товарів" value={countFormat.format(brand.productCount)} note={totalProducts ? `${share(brand.productCount, totalProducts)} каталогу` : undefined} part={brand.productCount} total={totalProducts} />
        <DictionaryMetric icon={IconBox} label="У наявності" value={count(inStock)} part={inStock.data?.totalItems} total={brand.productCount} />
        <DictionaryMetric icon={IconPhotoOff} label="Без фото" value={count(noPhoto)} part={noPhoto.data?.totalItems} total={brand.productCount} />
      </dl>

      <ProductPreviewGrid
        title="Товари бренду"
        cacheKey={`catalog-brand-preview:${brand.name}`}
        filter={{ brand: brand.name }}
        listHref={productsLink}
        enabled={hasProducts}
        emptyText="У бренду ще немає товарів."
      />
    </section>
  )
}
