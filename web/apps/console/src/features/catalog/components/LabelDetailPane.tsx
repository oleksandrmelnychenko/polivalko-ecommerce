import { Button, Switch } from '@mantine/core'
import { IconPencil } from '@tabler/icons-react'
import type { ProductLabel } from '../api/dictionariesApi'
import { isAutoLabel, labelRule } from '../lib/labels'
import { LabelChip } from './LabelChip'
import { ProductPreviewGrid } from './ProductPreviewGrid'

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
            <span className="catalog-label-hero-chip" aria-hidden="true">
              <LabelChip name={label.name} tone={label.tone} muted={!label.isActive} />
            </span>
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

        <dl className="app-split-stats">
          <div>
            <dt>Товарів з міткою</dt>
            <dd>
              {countFormat.format(label.productCount)}
              {totalProducts && label.productCount && label.productCount <= totalProducts ? <small>{share(label.productCount, totalProducts)} каталогу</small> : null}
            </dd>
          </div>
          <div>
            <dt>На вітрині</dt>
            <dd>{label.isActive ? 'Так' : 'Ні'}</dd>
          </div>
          <div>
            <dt>Порядок показу</dt>
            <dd>{label.sortOrder}</dd>
          </div>
        </dl>
      </header>

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
