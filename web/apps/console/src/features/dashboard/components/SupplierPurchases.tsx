import { IconChevronDown, IconFileInvoice } from '@tabler/icons-react'
import { Button } from '@mantine/core'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { dateLabel, formatPrice } from '@/shared/lib/salesFormat'
import { DocumentLink } from '@/shared/ui/DocumentLink'
import { TableChip } from '@/shared/ui/TableChip'
import type { LastPurchase, SupplierBudget } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'
import { SeasonIndicator, SupplierBasket, type Basket } from './SupplierBasket'
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
      {purchase.unitPrice != null && purchase.day.slice(0, 4) < year && <> <TableChip tone="warning" value="Ціна попередніх років" /></>}
    </div>
    {purchase.documentId && <PurchaseInvoices invoices={[{ id: purchase.documentId, number: purchase.number, day: purchase.day }]} />}
    {purchase.issue && <span>{issueText[purchase.issue]}</span>}
  </div>
}

export function BudgetBySupplier({ budget, count, through, days, cover, seasonal, basket }: {
  budget: SupplierBudget; count: number; through: string; days: number; cover: number; seasonal: boolean; basket: Basket
}) {
  const [basketOpen, setBasketOpen] = useState(false)
  const budgetRef = useRef<HTMLElement>(null)
  function showBasketItem(id: string) {
    const field = budgetRef.current?.querySelector<HTMLInputElement>(`input[data-basket-item="${CSS.escape(id)}"]`)
    const order = field?.closest('details')
    const cart = order?.parentElement?.closest('details')
    if (!field || !order || !cart) return
    cart.open = true
    order.open = true
    field.focus({ preventScroll: true })
    field.scrollIntoView({ block: 'center' })
  }
  const year = through.slice(0, 4)
  const historical = budget.suppliers.flatMap(group => group.items.filter(item => item.priceDay && item.priceDay.slice(0, 4) < year)
    .map(item => ({ item, supplier: group.name })))
  const priced = count - budget.unpriced
  const selected = new Map(basket.picked.map(row => [row.id, row]))
  const groups = budget.suppliers.flatMap(group => {
    const isPicked = (item: typeof group.items[number]) => {
      const row = selected.get(item.id)
      return row !== undefined && row.supplier === group.id && row.unit === item.unit
    }
    const remaining = group.items.filter(item => !isPicked(item))
    if (basketOpen && remaining.length < group.items.length) return []
    return <details key={group.id ?? 'unknown'} className="dash-budget-group">
      <summary>
        <span className="dash-budget-supplier">{group.name || 'Уточнити постачальника'}<small>{numberFormat.format(group.items.length)} поз.
          {group.unpriced > 0 && <> · без оцінки {numberFormat.format(group.unpriced)}</>}</small></span>
        <strong>{group.items.length > group.unpriced ? formatPrice(group.subtotal) : 'Сума невідома'}</strong>
        <IconChevronDown size={15} aria-hidden="true" />
      </summary>
      {remaining.length > 1 && <Button size="compact-xs" variant="default" onClick={() => basket.add([{ ...group, items: remaining }])}>Додати всі до кошика · {remaining.length}</Button>}
      <ul>{group.items.map(item => <li key={item.id}>
        <div className="dash-budget-item"><Link className="dash-budget-product" title="Відкрити картку товару" to={'/catalog/products/' + encodeURIComponent(item.id)}>{item.name}</Link>
          {item.sku && <small className="app-cell-sub">Артикул {item.sku}</small>}
          {item.receiptId && item.priceDay && <DocumentLink className="dash-receipt-pill" id={item.receiptId}><IconFileInvoice size={14} aria-hidden="true" />Накладна від {dateLabel(item.priceDay)}</DocumentLink>}
          {seasonal && <div><SeasonIndicator season={item.season} /></div>}
          {isPicked(item)
            ? <Button size="compact-xs" variant="default" onClick={() => showBasketItem(item.id)}>Переглянути в кошику</Button>
            : <Button size="compact-xs" onClick={() => basket.add([{ ...group, items: [item] }])}>Додати до кошика</Button>}
        </div>
        <span>{numberFormat.format(item.quantity)} {item.unit}{item.unitPrice != null && ' × ' + priceFormat.format(item.unitPrice) + ' ₴'}</span>
        <strong>{item.amount == null ? 'Ціну уточнити' : formatPrice(item.amount)}</strong>
      </li>)}</ul>
    </details>
  })
  return <section ref={budgetRef} className="dash-supplier-budget" aria-label="Бюджет закупівлі">
    <div className="dash-budget-header">
      <h3>Рекомендована закупівля</h3>
      <strong>{priced || !count ? formatPrice(budget.subtotal) : 'Суму ще не визначено'}{budget.unpriced > 0 && ' + без ціни: ' + budget.unpriced}</strong>
      <div className="dash-budget-context"><TableChip value={`Продажі за ${days} днів`} /><TableChip value={`Запас на ${cover} днів`} />
        <TableChip tone="source" value={seasonal ? 'З урахуванням сезону' : 'За поточним темпом'} /></div>
    </div>
    {historical.length > 0 && <details className="dash-price-history"><summary>Товари з цінами попередніх років <TableChip tone="warning" value={historical.length} /><IconChevronDown size={16} aria-hidden="true" /></summary>
      <ul>{historical.map(({ item, supplier }) => <li key={item.id}>
        <div className="dash-history-item"><strong>{item.name}</strong><span>{supplier || 'Уточнити постачальника'}</span></div>
        <div className="dash-history-amount"><span>{numberFormat.format(item.quantity)} {item.unit}{item.unitPrice != null && <> × {priceFormat.format(item.unitPrice)} ₴</>}</span>
          <strong>{item.amount == null ? 'Ціну уточнити' : formatPrice(item.amount)}</strong></div>
        {item.receiptId && <DocumentLink className="dash-receipt-pill" id={item.receiptId}><IconFileInvoice size={14} aria-hidden="true" />Накладна від {dateLabel(item.priceDay!)}</DocumentLink>}
      </li>)}</ul></details>}
    <SupplierBasket basket={basket} groups={budget.suppliers} days={days} cover={cover} through={through} seasonal={seasonal} onOpenChange={setBasketOpen} />
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
