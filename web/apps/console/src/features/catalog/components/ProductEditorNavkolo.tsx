import { ActionIcon, Tooltip } from '@mantine/core'
import { IconCash, IconPackages, IconPencil } from '@tabler/icons-react'
import { CatalogSectionTitle } from './CatalogSectionTitle'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { useState } from 'react'
import type { Product } from '../api/catalogApi'
import { ProductPriceDialog } from './ProductPriceDialog'
import { ProductStockDialog } from './ProductStockDialog'

type ProductEditorNavkoloProps = {
  product: Product
  canUpdatePrice: boolean
  priceLoading: boolean
  onReload: () => void
  onPriceSaved: (product: Product) => void
}

export function ProductEditorNavkolo({ product, canUpdatePrice, priceLoading, onReload, onPriceSaved }: ProductEditorNavkoloProps) {
  const n = product.navkolo
  const [editingPrice, setEditingPrice] = useState(false)
  const [editingStock, setEditingStock] = useState(false)
  return (
    <div className="product-editor-metrics">
      <section className="catalog-card product-metric" aria-labelledby="retail-title">
        <CatalogSectionTitle id="retail-title" icon={IconCash}>Ціна</CatalogSectionTitle>
        {canUpdatePrice && <Tooltip label="Змінити роздрібну ціну"><ActionIcon variant="light" color="gray" aria-label="Змінити роздрібну ціну" disabled={priceLoading} onClick={() => setEditingPrice(true)}><IconPencil size={16} /></ActionIcon></Tooltip>}
        <div className="product-metric-value">{formatMoney(n.price)} {n.oldPrice && <s aria-label="Попередня ціна">{formatMoney(n.oldPrice)}</s>}</div>
        <small>Оновлено {formatDateTime(n.priceUpdatedAt)}</small>
      </section>
      <section className="catalog-card product-metric" aria-labelledby="stock-title">
        <CatalogSectionTitle id="stock-title" icon={IconPackages}>Залишок</CatalogSectionTitle>
        {canUpdatePrice && <Tooltip label="Змінити залишок"><ActionIcon variant="light" color="gray" aria-label="Змінити залишок" disabled={priceLoading} onClick={() => setEditingStock(true)}><IconPencil size={16} /></ActionIcon></Tooltip>}
        <div className="product-metric-value">{new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 }).format(n.stock)}</div>
        <small>Оновлено {formatDateTime(n.stockUpdatedAt)}</small>
      </section>
      {editingStock && <ProductStockDialog product={product} onClose={() => setEditingStock(false)} onReload={onReload} />}
      {canUpdatePrice && editingPrice ? (
        <ProductPriceDialog
          product={product}
          onClose={() => setEditingPrice(false)}
          onReload={onReload}
          onSaved={updated => { onPriceSaved(updated); setEditingPrice(false) }}
        />
      ) : null}
    </div>
  )
}
