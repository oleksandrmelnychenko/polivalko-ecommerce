import { IconChevronDown } from '@tabler/icons-react'
import { Button } from '@mantine/core'
import { Link } from 'react-router-dom'
import { dateLabel, formatPrice } from '@/shared/lib/salesFormat'
import { DocumentLink } from '@/shared/ui/DocumentLink'
import type { LastPurchase, SupplierBudget } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'
import { SupplierBasket, seasonText, type Basket } from './SupplierBasket'
import { PurchaseInvoices } from './PurchaseInvoices'

const priceFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 6 })
const issueText = {
  ambiguous: 'Останню накладну не вдалося визначити однозначно.',
  unit: 'Для розрахунку суми потрібно звірити одиниці виміру.',
  price: 'Ціну в гривнях потрібно уточнити за накладною.',
}

export function ReceiptPrice({ purchase, year }: { purchase: LastPurchase | null; year: string }) {
  if (!purchase) return <span className="app-cell-sub">У реєстрі немає отриманої прибуткової накладної для цього товару.</span>
  return <div className="dash-last-purchase">
    <div>{purchase.supplier || 'Постачальника слід уточнити'}
      {purchase.unitPrice != null && <> · {priceFormat.format(purchase.unitPrice)} ₴/{purchase.unit}</>}
      {purchase.unitPrice != null && purchase.day.slice(0, 4) < year && ' · ціна попередніх років'}
    </div>
    {purchase.documentId && <PurchaseInvoices invoices={[{ id: purchase.documentId, number: purchase.number, day: purchase.day }]} />}
    {purchase.issue && <span>{issueText[purchase.issue]}</span>}
  </div>
}

export function BudgetBySupplier({ budget, count, through, days, cover, seasonal, basket }: {
  budget: SupplierBudget; count: number; through: string; days: number; cover: number; seasonal: boolean; basket: Basket
}) {
  const year = through.slice(0, 4)
  const historical = budget.suppliers.flatMap(group => group.items.filter(item => item.priceDay && item.priceDay.slice(0, 4) < year)
    .map(item => ({ item, supplier: group.name })))
  const priced = count - budget.unpriced
  const groups = budget.suppliers.map(group => <details key={group.id ?? 'unknown'} className="dash-budget-group">
      <summary>
        <span className="dash-budget-supplier">{group.name || 'Уточнити постачальника'}<small>{numberFormat.format(group.items.length)} поз.
          {group.unpriced > 0 && <> · без оцінки {numberFormat.format(group.unpriced)}</>}</small></span>
        <strong>{group.items.length > group.unpriced ? formatPrice(group.subtotal) : 'Сума невідома'}</strong>
        <IconChevronDown size={15} aria-hidden="true" />
      </summary>
      <Button size="compact-xs" variant="subtle" onClick={() => basket.add([group])}>Додати товари постачальника</Button>
      <ul>{group.items.map(item => <li key={item.id}>
        <div><Link to={'/catalog/products/' + encodeURIComponent(item.id)}>{item.name}{item.sku && <small> · {item.sku}</small>}</Link>
          {item.receiptId && item.priceDay && <small className="app-cell-sub"><DocumentLink id={item.receiptId}>Ціна від {dateLabel(item.priceDay)}</DocumentLink></small>}
          {seasonal && <small className="app-cell-sub">{seasonText(item.season)}</small>}
          <Button size="compact-xs" variant="subtle" disabled={basket.picked.some(row => row.id === item.id && row.supplier === group.id && row.unit === item.unit)}
            onClick={() => basket.add([{ ...group, items: [item] }])}>До кошика</Button>
        </div>
        <span>{numberFormat.format(item.quantity)} {item.unit}{item.unitPrice != null && ' × ' + priceFormat.format(item.unitPrice) + ' ₴'}</span>
        <strong>{item.amount == null ? 'Ціну уточнити' : formatPrice(item.amount)}</strong>
      </li>)}</ul>
    </details>)
  return <section className="dash-supplier-budget" aria-label="Бюджет закупівлі">
    <div className="dash-budget-context">Продажі за {days} днів · запас на {cover} днів · {seasonal ? 'з урахуванням сезону' : 'за поточним темпом'}</div>
    <div className="dash-budget-header">
      <h3>До закупівлі</h3>
      <strong>{priced || !count ? formatPrice(budget.subtotal) : 'Суму ще не визначено'}{budget.unpriced > 0 && ' + без ціни: ' + budget.unpriced}</strong>
    </div>
    <p>Оцінено {priced} із {count} позицій за останніми цінами прибуткових накладних.
      {budget.historicalCount > 0 && <> Ціни до {year} року використано для {budget.historicalCount} поз. на {formatPrice(budget.historicalAmount)}.</>}</p>
    {historical.length > 0 && <details className="dash-price-history"><summary>Товари з цінами попередніх років · {historical.length}</summary>
      <ul>{historical.map(({ item, supplier }) => <li key={item.id}><b>{item.name}</b> · {supplier || 'Уточнити постачальника'}
        <small>{numberFormat.format(item.quantity)} {item.unit} × {priceFormat.format(item.unitPrice!)} ₴ · {formatPrice(item.amount!)}</small>
        {item.receiptId && <DocumentLink id={item.receiptId}>Накладна від {dateLabel(item.priceDay!)}</DocumentLink>}
      </li>)}</ul></details>}
    <SupplierBasket basket={basket} groups={budget.suppliers} days={days} cover={cover} through={through} seasonal={seasonal} />
    {basket.error && <p role="alert">{basket.error}</p>}
    {groups.length > 0 && <div className="dash-budget-list">
      {groups.slice(0, 3)}
      {groups.length > 3 && <details className="dash-budget-more">
        <summary>Інші постачальники · {groups.length - 3}<IconChevronDown size={15} aria-hidden="true" /></summary>
        {groups.slice(3)}
      </details>}
    </div>}
  </section>
}
