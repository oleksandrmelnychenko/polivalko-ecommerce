import { Button } from '@mantine/core'
import type { ApiQueryStatus } from '@/shared/api/useApiQuery'
import type { ProductCounts } from '../api/dashboardApi'
import { QueueTile } from './QueueTile'

type CatalogAttentionProps = {
  counts: ProductCounts | undefined
  status: ApiQueryStatus
  onRetry: () => void
}

export function CatalogAttention({ counts, status, onRetry }: CatalogAttentionProps) {
  const items = [
    { key: 'fill', n: counts?.needsFilling, label: 'Без фото, опису чи характеристик', href: '/catalog/products?fill=any-missing', hot: true },
    { key: 'new', n: counts?.recent30, label: 'Нові товари за 30 днів', href: '/catalog/products?newDays=30', hot: false },
    { key: 'hidden', n: counts?.hiddenWithStock, label: 'Приховані товари в наявності', href: '/catalog/products?hiddenWithStock=true', hot: true },
  ]

  return (
    <section className="dash-attention" aria-labelledby="dash-attention-title">
      <header className="dash-attention-head">
        <h2 id="dash-attention-title" className="dash-attention-title">
          Потребує уваги
        </h2>
        {status === 'error' ? (
          <span className="dash-attention-error" role="alert">
            Не вдалося порахувати товари.
            <Button variant="subtle" size="compact-xs" onClick={onRetry}>
              Повторити
            </Button>
          </span>
        ) : null}
      </header>
      <ul className="dash-queue is-three" aria-label="Каталог: потребує уваги">
        {items.map((item) => (
          <QueueTile key={item.key} count={item.n} label={item.label} href={item.href} hot={item.hot} busy={status === 'loading'} />
        ))}
      </ul>
    </section>
  )
}
