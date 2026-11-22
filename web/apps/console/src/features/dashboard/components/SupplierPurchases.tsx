import { IconChevronDown, IconFileInvoice } from '@tabler/icons-react'
import { Button } from '@mantine/core'
import { Link } from 'react-router-dom'
import { dateLabel, formatPrice } from '@/shared/lib/salesFormat'
import { DocumentLink } from '@/shared/ui/DocumentLink'
import { TableChip } from '@/shared/ui/TableChip'
import type { LastPurchase, SupplierBudget } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'
import { SeasonIndicator, SupplierBasket, type Basket } from './SupplierBasket'

const priceFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 6 })
const issueText = {
  ambiguous: 'Останню накладну не вдалося визначити однозначно.',
  unit: 'Для розрахунку суми потрібно звірити одиниці виміру.',
  price: 'Ціну в гривнях потрібно уточнити за накладною.',
}

export function ReceiptPrice({ purchase }: { purchase: LastPurchase | null }) {
  if (!purchase) return <small className="dash-last-purchase">Закупівельна ціна невідома. Прибуткової накладної для товару немає.</small>
  const receipt = <>{purchase.number ? 'Накладна № ' + purchase.number : 'Накладна'} від <time dateTime={purchase.day}>{dateLabel(purchase.day)}</time></>
  return <div className="dash-last-purchase">
    <div>{purchase.supplier || 'Постачальника слід уточнити'}{purchase.unitPrice != null && <> · {priceFormat.format(purchase.unitPrice)} ₴/{purchase.unit || 'од.'}</>}</div>
    {purchase.documentId ? <DocumentLink id={purchase.documentId}>{receipt}</DocumentLink> : <span>{receipt}</span>}
    {purchase.issue && <span>{issueText[purchase.issue]}</span>}
  </div>
}

export function BudgetBySupplier({ budget, count, through, days, cover, seasonal, basket }: {
  budget: SupplierBudget; count: number; through: string; days: number; cover: number; seasonal: boolean; basket: Basket
}) {
  // A price is old when its receipt is more than a year before the plan; the service counts by the same text.
  const yearAgo = String(Number(through.slice(0, 4)) - 1).padStart(4, '0') + through.slice(4)
  const historical = budget.suppliers.flatMap(group => group.items.filter(item => item.priceDay && item.priceDay < yearAgo)
    .map(item => ({ item, supplier: group.name })))
  const priced = count - budget.unpriced
  const selected = new Map(basket.picked.map(row => [row.id, row]))
  const groups = budget.suppliers.filter(group => group.items.length > 0 && !group.items.some(item => {
    const row = selected.get(item.id)
    return row !== undefined && row.supplier === group.id && row.unit === item.unit
  })).map(group => {
    return <details key={group.id ?? 'unknown'} className="dash-budget-group">
      <summary>
        <span className="dash-budget-supplier">{group.name || 'Уточнити постачальника'}<small>{numberFormat.format(group.items.length)} поз.
          {group.unpriced > 0 && <> · без оцінки {numberFormat.format(group.unpriced)}</>}</small></span>
        <strong>{group.items.length > group.unpriced ? formatPrice(group.subtotal) : 'Сума невідома'}</strong>
        <IconChevronDown size={15} aria-hidden="true" />
      </summary>
      {group.items.length > 1 && <Button size="compact-xs" variant="default" onClick={() => basket.add([group])}>Додати всі до кошика · {group.items.length}</Button>}
      <ul>{group.items.map(item => <li key={item.id}>
        <div className="dash-budget-item"><Link className="dash-budget-product" title="Відкрити картку товару" to={'/catalog/products/' + encodeURIComponent(item.id)}>{item.name}</Link>
          {item.sku && <small className="app-cell-sub">Артикул {item.sku}</small>}
          {seasonal && <SeasonIndicator season={item.season} />}
        </div>
        <div className="dash-budget-amount">
          <strong>{item.amount == null ? 'Ціну уточнити' : formatPrice(item.amount)}</strong>
          <span>{numberFormat.format(item.quantity)} {item.unit}{item.unitPrice != null && ' × ' + priceFormat.format(item.unitPrice) + ' ₴'}</span>
        </div>
        <div className="dash-budget-actions">
          {item.receiptId && item.priceDay && <DocumentLink className="dash-receipt-pill" id={item.receiptId}><IconFileInvoice size={14} aria-hidden="true" />Накладна від {dateLabel(item.priceDay)}</DocumentLink>}
          <Button size="compact-xs" onClick={() => basket.add([{ ...group, items: [item] }])}>Додати до кошика</Button>
        </div>
      </li>)}</ul>
    </details>
  })
  return <section className="dash-supplier-budget" aria-label="Бюджет закупівлі">
    <div className="dash-budget-header">
      <h3>Рекомендована закупівля</h3>
      <strong>{priced || !count ? formatPrice(budget.subtotal) : 'Суму ще не визначено'}{budget.unpriced > 0 && ' + без ціни: ' + budget.unpriced}</strong>
      <div className="dash-budget-context"><TableChip value={`Продажі за ${days} днів`} /><TableChip value={`Запас на ${cover} днів`} />
        <TableChip tone="source" value={seasonal ? 'З урахуванням сезону' : 'За поточним темпом'} /></div>
    </div>
    {historical.length > 0 && <details className="dash-price-history"><summary>Товари з цінами, старшими за рік <TableChip tone="warning" value={numberFormat.format(historical.length) + ' поз.'} /><IconChevronDown size={16} aria-hidden="true" /></summary>
      <ul>{historical.map(({ item, supplier }) => <li key={item.id}>
        <div className="dash-history-item"><strong>{item.name}</strong><span>{supplier || 'Уточнити постачальника'}</span></div>
        <div className="dash-history-amount"><span>{numberFormat.format(item.quantity)} {item.unit}{item.unitPrice != null && <> × {priceFormat.format(item.unitPrice)} ₴</>}</span>
          <strong>{item.amount == null ? 'Ціну уточнити' : formatPrice(item.amount)}</strong></div>
        {item.receiptId && <DocumentLink className="dash-receipt-pill" id={item.receiptId}><IconFileInvoice size={14} aria-hidden="true" />Накладна від {dateLabel(item.priceDay!)}</DocumentLink>}
      </li>)}</ul></details>}
    <SupplierBasket basket={basket} groups={budget.suppliers} days={days} cover={cover} through={through} seasonal={seasonal} />
    {basket.error && <p role="alert">{basket.error}</p>}
    {groups.length > 0 && <details className="dash-budget-list">
      <summary>Додати постачальників
        <TableChip value={numberFormat.format(groups.length)} /><IconChevronDown size={16} aria-hidden="true" /></summary>
      {groups}
    </details>}
  </section>
}
