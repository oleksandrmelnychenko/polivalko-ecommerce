import { Button } from '@mantine/core'
import { IconChevronRight } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import type { ApiQueryStatus } from '@/shared/api/useApiQuery'
import type { ProductCounts } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'

type CatalogAttentionProps = {
  counts: ProductCounts | undefined
  status: ApiQueryStatus
  onRetry: () => void
}

export function CatalogAttention({ counts, status, onRetry }: CatalogAttentionProps) {
  const items = [
    { key: 'fill', n: counts?.needsFilling, label: 'товарів без фото, опису чи характеристик', href: '/catalog/products?fill=any-missing', hot: true },
    { key: 'new', n: counts?.recent30, label: 'нових товарів за 30 днів: перевірте картки', href: '/catalog/products?newDays=30', hot: false },
    { key: 'hidden', n: counts?.hiddenWithStock, label: 'прихованих товарів, які є в наявності', href: '/catalog/products?hiddenWithStock=true', hot: true },
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
        {items.map((item) => {
          const n = item.n ?? null
          const className = `dash-queue-item${item.hot && n !== null && n > 0 ? ' is-hot' : ''}`
          return (
            <li key={item.key}>
              <Link to={item.href} className={className} aria-busy={status === 'loading' || undefined}>
                <b>{n === null ? '·' : numberFormat.format(n)}</b>
                <span>{item.label}</span>
                <IconChevronRight size={16} stroke={1.8} aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
