import { dateLabel } from '@/shared/lib/salesFormat'
import { DocumentLink } from '@/shared/ui/DocumentLink'
import type { SupplierSupply } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'

// A delivery that needs checking is not part of the plan, but the lower bound of the need assumes it arrives.
const lowerBound = ' · у нижній межі потреби вважаємо, що надійде'
const timingText = {
  within: 'Враховано в плані', later: 'Після планового періоду', overdue: 'Дата минула' + lowerBound, undated: 'Строк не вказано' + lowerBound,
  review: 'Стан або приймання потребує звірки' + lowerBound, units: 'Звірити одиниці виміру' + lowerBound, 'other-store': 'Інший склад або організація',
}

export function SupplierOrders({ supply, unit }: { supply: SupplierSupply; unit: string | null }) {
  if (!supply.orders.length) return null
  // What is still to arrive at this product's warehouse: orders for another warehouse and quantities
  // already received do not belong in the headline.
  const own = supply.orders.filter(order => order.timing !== 'other-store')
  const totals = new Map<string, number>()
  for (const order of own) totals.set(order.unit, (totals.get(order.unit) ?? 0) + (order.remaining ?? order.ordered))
  const pending = [...totals].map(([u, qty]) => numberFormat.format(qty) + ' ' + u).join(', ')
  const next = own.find(o => o.timing === 'within' || o.timing === 'later')
  return <details className="app-cell-sub">
    <summary>{own.length ? `Ще очікуємо за замовленнями · ${pending}. ${next?.eta ? 'Очікуємо ' + dateLabel(next.eta) : 'Дату надходження слід уточнити'}`
      : 'Є замовлення лише для іншого складу або організації'}</summary>
    <div>Підтверджено до отримання · {numberFormat.format(supply.confirmed)} {unit} · з них відправлено {numberFormat.format(supply.inTransit)} {unit}</div>
    {supply.orders.map((o, index) => <div key={o.id + '-' + index}>
      <DocumentLink id={o.id}>Замовлення №{o.number || '—'} від {dateLabel(o.day)}</DocumentLink>
      <div>Замовлено {numberFormat.format(o.ordered)} {o.unit} · прийнято за зв’язаними накладними {o.received == null ? '—' : numberFormat.format(o.received) + ' ' + o.unit} · залишилось {o.remaining == null ? '—' : numberFormat.format(o.remaining) + ' ' + o.unit}</div>
      <div>{o.eta ? 'Планове надходження ' + dateLabel(o.eta) : 'Планову дату не вказано'} · {timingText[o.timing]}</div>
    </div>)}
  </details>
}
