import { Anchor, Button, Text } from '@mantine/core'
import { Link } from 'react-router-dom'
import { Can } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { IconChartHistogram, IconExternalLink } from '@tabler/icons-react'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { useState } from 'react'
import { siteUrl } from '@/shared/lib/siteUrl'
import type { Product } from '../api/catalogApi'
import { cleanProductName } from '../lib/productFilters'
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
  const [priceSaved, setPriceSaved] = useState(false)
  return (
    <aside className="catalog-card catalog-navkolo" aria-labelledby="navkolo-title">
      <h2 id="navkolo-title" className="app-section-title catalog-card-title">
        Ціна й залишок
      </h2>
      <dl className="catalog-dl">
        <dt>Артикул</dt>
        <dd className="catalog-code">{n.sku}</dd>
        <dt>Назва в обліку</dt>
        <dd>{cleanProductName(n.name)}</dd>
        <dt>Ціна</dt>
        <dd>
          <span className="app-money">{formatMoney(n.price)}</span>
          {n.oldPrice ? <s className="catalog-muted"> <span className="money">{formatMoney(n.oldPrice)}</span></s> : null}
        </dd>
        <dt>Залишок</dt>
        <dd className="app-number">{n.stock}</dd>
        <dt>Група</dt>
        <dd>{n.groupRef ?? <span className="catalog-muted">не задано</span>}</dd>
        {n.variantGroup ? (
          <>
            <dt>Варіант</dt>
            <dd>
              {n.variantLabel ?? 'без підпису'} <span className="catalog-muted">({n.variantGroup})</span>
            </dd>
          </>
        ) : null}
        <dt>Ціну оновлено</dt>
        <dd>{formatDateTime(n.priceUpdatedAt)}</dd>
        <dt>Ідентифікатор</dt>
        <dd className="catalog-code catalog-break">{n.navkoloId}</dd>
      </dl>
      {canUpdatePrice ? (
        <Button variant="default" size="sm" mb="sm" disabled={priceLoading} onClick={() => { setEditingPrice(true); setPriceSaved(false) }}>
          Змінити роздрібну ціну
        </Button>
      ) : null}
      {priceSaved ? <Text size="sm" role="status" mb="sm">Роздрібну ціну оновлено.</Text> : null}
      {canUpdatePrice && <Button variant="default" size="sm" mb="sm" disabled={priceLoading} onClick={() => setEditingStock(true)}>Змінити залишок</Button>}
      {editingStock && <ProductStockDialog product={product} onClose={() => setEditingStock(false)} onReload={onReload} />}
      <div className="product-related-links">
        <Can permission={PermissionKeys.Analytics.ViewProducts}>
          <Anchor component={Link} to={`/sales/product-analytics?product=${product.id}`} size="sm" className="catalog-site-link">
            <IconChartHistogram size={15} />Аналітика товару
          </Anchor>
        </Can>
        <Anchor href={siteUrl(`/product/${product.slug}`)} target="_blank" rel="noopener" size="sm" className="catalog-site-link">
          <IconExternalLink size={15} />Відкрити на сайті
        </Anchor>
      </div>
      {canUpdatePrice && editingPrice ? (
        <ProductPriceDialog
          product={product}
          onClose={() => setEditingPrice(false)}
          onReload={onReload}
          onSaved={updated => { onPriceSaved(updated); setEditingPrice(false); setPriceSaved(true) }}
        />
      ) : null}
    </aside>
  )
}
