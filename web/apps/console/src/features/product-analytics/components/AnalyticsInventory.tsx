import type { ProductAnalytics } from '../api/productAnalyticsApi'
import { formatAmount } from '../lib/format'
import { AnalyticsCard } from './AnalyticsCard'

export function AnalyticsInventory({ inventory }: { inventory: ProductAnalytics['inventory'] }) {
  const { healthyProducts, lowStockProducts, outOfStockProducts, lowStockThreshold } = inventory
  const levels = [
    { key: 'healthy', title: 'Достатній запас', count: healthyProducts },
    { key: 'low', title: `Мало запасу (до ${formatAmount(lowStockThreshold)} од.)`, count: lowStockProducts },
    { key: 'out', title: 'Немає в наявності', count: outOfStockProducts },
  ]

  return (
    <AnalyticsCard title="Наявність товарів" description="Активні товари в каталозі сайту · після резервів">
      <div className="pa-inventory">
        {levels.some(({ count }) => count > 0) ? (
          <div className="pa-inventory-bar" aria-hidden="true">
            {levels.filter(({ count }) => count > 0).map(({ key, count }) => (
              <span key={key} data-level={key} style={{ flexGrow: count }} />
            ))}
          </div>
        ) : null}
        <ul>
          {levels.map(({ key, title, count }) => (
            <li key={key} data-level={key}>
              <span className="pa-inventory-dot" aria-hidden="true" />
              <span>{title}</span><strong>{formatAmount(count)}</strong>
            </li>
          ))}
        </ul>
      </div>
    </AnalyticsCard>
  )
}
