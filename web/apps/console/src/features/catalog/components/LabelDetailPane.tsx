import { Button, Switch } from '@mantine/core'
import { IconPackage, IconEye, IconListNumbers, IconTag, IconPencil } from '@tabler/icons-react'
import type { ProductLabel } from '../api/dictionariesApi'
import { isAutoLabel, labelRule } from '../lib/labels'
import { ProductPreviewGrid } from './ProductPreviewGrid'
import { DictionaryMetric } from './DictionaryLayout'

const countFormat = new Intl.NumberFormat('uk-UA')
const percentFormat = new Intl.NumberFormat('uk-UA', { style: 'percent', maximumFractionDigits: 0 })

type LabelDetailPaneProps = {
  label: ProductLabel | null
  totalProducts: number | null
  toggling: boolean
  onEdit: (label: ProductLabel) => void
  onToggle: (label: ProductLabel, isActive: boolean) => void
}

function share(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) return percentFormat.format(0)
  const value = part / whole
  return value < 0.01 ? `<${percentFormat.format(0.01)}` : percentFormat.format(value)
}

export function LabelDetailPane({ label, totalProducts, toggling, onEdit, onToggle }: LabelDetailPaneProps) {
  if (!label) return <section className="app-split-detail app-split-detail-empty">Оберіть мітку зліва.</section>

  const auto = isAutoLabel(label)

  return (
    <section key={label.id} className="app-split-detail" aria-labelledby="label-detail-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <span className="app-split-kind-icon" aria-hidden="true"><IconTag size={17} /></span>
            <div className="app-split-hero-main">
              <p className="app-split-hero-kicker">{auto ? 'Ставиться автоматично' : 'Ставиться вручну'}</p>
              <h2 id="label-detail-title">{label.name}</h2>
              <p className="app-split-description">{labelRule(label)}.</p>
            </div>
          </div>
          <div className="app-split-actions">
            <span className="app-split-switch">
              <Switch
                size="sm"
                label="На сайті"
                checked={label.isActive}
                disabled={toggling}
                onChange={(event) => onToggle(label, event.currentTarget.checked)}
              />
            </span>
            <Button variant="default" size="sm" leftSection={<IconPencil size={16} stroke={1.7} />} onClick={() => onEdit(label)}>
              Змінити
            </Button>
          </div>
        </div>
      </header>

      <dl className="catalog-metrics">
        <DictionaryMetric icon={IconPackage} label="Товарів з міткою" value={countFormat.format(label.productCount)} note={totalProducts && label.productCount <= totalProducts ? `${share(label.productCount, totalProducts)} каталогу` : undefined} part={label.productCount} total={totalProducts} />
        <DictionaryMetric icon={IconEye} label="На вітрині" value={label.isActive ? 'Так' : 'Ні'} />
        <DictionaryMetric icon={IconListNumbers} label="Порядок показу" value={countFormat.format(label.sortOrder)} />
      </dl>

      <ProductPreviewGrid
        title="Товари з міткою"
        cacheKey={`catalog-label-preview:${label.id}`}
        filter={{ labelId: label.id }}
        listHref={`/catalog/products?labelId=${encodeURIComponent(label.id)}`}
        enabled={label.productCount > 0}
        emptyText={auto ? 'Зараз жоден товар не підпадає під правило.' : 'Мітку ще не поставили жодному товару. Це робиться в картці товару або масово у списку.'}
      />
    </section>
  )
}
