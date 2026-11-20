import { Anchor, Button, Text } from '@mantine/core'
import { IconExternalLink } from '@tabler/icons-react'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { useState } from 'react'
import { siteUrl } from '@/shared/lib/siteUrl'
import type { Product } from '../api/catalogApi'
import { ProductPriceDialog } from './ProductPriceDialog'

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
  const [priceSaved, setPriceSaved] = useState(false)
  return (
    <aside className="catalog-card catalog-navkolo" aria-labelledby="navkolo-title">
      <h2 id="navkolo-title" className="app-section-title catalog-card-title">
        З Navkolo
      </h2>
      <Text size="xs" c="dimmed" mb="sm">
        Ці дані надходять з обліку.
      </Text>
      <dl className="catalog-dl">
        <dt>Артикул</dt>
        <dd className="catalog-code">{n.sku}</dd>
        <dt>Назва в обліку</dt>
        <dd>{n.name}</dd>
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
      <Anchor href={siteUrl(`/product/${product.slug}`)} target="_blank" rel="noopener" size="sm" className="catalog-site-link">
        <IconExternalLink size={15} stroke={1.7} />
        Відкрити на сайті
      </Anchor>
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
