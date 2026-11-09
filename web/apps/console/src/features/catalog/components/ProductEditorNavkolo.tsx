import { Anchor, Text } from '@mantine/core'
import { IconExternalLink } from '@tabler/icons-react'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { siteUrl } from '@/shared/lib/siteUrl'
import type { Product } from '../api/catalogApi'

export function ProductEditorNavkolo({ product }: { product: Product }) {
  const n = product.navkolo
  return (
    <aside className="catalog-card catalog-navkolo" aria-labelledby="navkolo-title">
      <h2 id="navkolo-title" className="app-section-title catalog-card-title">
        З Navkolo
      </h2>
      <Text size="xs" c="dimmed" mb="sm">
        Ці поля оновлює синхронізація з обліком. Тут їх змінити не можна.
      </Text>
      <dl className="catalog-dl">
        <dt>Артикул</dt>
        <dd className="catalog-code">{n.sku}</dd>
        <dt>Назва в обліку</dt>
        <dd>{n.name}</dd>
        <dt>Ціна</dt>
        <dd>
          <span className="app-money">{formatMoney(n.price)}</span>
          {n.oldPrice ? <s className="catalog-muted"> {formatMoney(n.oldPrice)}</s> : null}
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
      <Anchor href={siteUrl(`/product/${product.slug}`)} target="_blank" rel="noopener" size="sm" className="catalog-site-link">
        <IconExternalLink size={15} stroke={1.7} />
        Відкрити на сайті
      </Anchor>
    </aside>
  )
}
