import { Link } from 'react-router-dom'
import { formatMoney } from '@polivalko/shared/lib/format'
import { thumb } from '@polivalko/shared/lib/images'
import { TableChip } from '@/shared/ui/TableChip'
import type { Dashboard } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'
import { DashboardCard } from './DashboardCard'

const LOW_STOCK = 3

function StockChip({ stock }: { stock: number }) {
  if (stock <= 0) return <TableChip tone="danger" value="Немає" />
  if (stock <= LOW_STOCK) return <TableChip tone="warning" value={`Мало · ${stock}`} />
  return <span className="app-number">{numberFormat.format(stock)}</span>
}

function ProductName({ id, name, canOpen }: { id: string; name: string; canOpen: boolean }) {
  return canOpen ? <Link to={`/catalog/products/${id}`}>{name}</Link> : <strong>{name}</strong>
}

export function TopProducts({ data, canOpen }: { data: Dashboard; canOpen: boolean }) {
  return (
    <DashboardCard title="Топ товарів" aside={<span className="dash-muted">за виручкою</span>} flush>
      {data.topProducts.length === 0 ? (
        <p className="dash-rank-empty">Продажів за період немає.</p>
      ) : (
        <ol className="dash-rank">
          {data.topProducts.map((product, index) => (
            <li key={product.productId}>
              <span className="dash-rank-n">{index + 1}</span>
              {product.imageUrl ? (
                <img className="dash-thumb" src={thumb(product.imageUrl, 120)} alt="" loading="lazy" width={40} height={40} />
              ) : (
                <span className="dash-thumb" aria-hidden="true" />
              )}
              <span className="dash-rank-main">
                <ProductName id={product.productId} name={product.name} canOpen={canOpen} />
                <span className="app-cell-sub">{product.sku}</span>
              </span>
              <span className="dash-rank-side">
                <span className="app-money">{formatMoney(product.revenue)}</span>
                <span className="app-cell-sub">{numberFormat.format(product.quantity)} шт.</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </DashboardCard>
  )
}

export function LowStock({ data, canOpen }: { data: Dashboard; canOpen: boolean }) {
  return (
    <DashboardCard
      title="Закінчуються"
      flush
      aside={
        canOpen ? (
          <Link to="/catalog/products?stock=low" className="dash-link">
            Усі
          </Link>
        ) : null
      }
    >
      {data.lowStock.length === 0 ? (
        <p className="dash-rank-empty">Усі товари в достатній кількості.</p>
      ) : (
        <ul className="dash-rank">
          {data.lowStock.map((item) => (
            <li key={item.id}>
              <span className="dash-rank-main">
                <ProductName id={item.id} name={item.name} canOpen={canOpen} />
                <span className="app-cell-sub">{item.sku}</span>
              </span>
              <span className="dash-rank-side">
                <StockChip stock={item.stock} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  )
}
