import { dateLabel } from '@/shared/lib/salesFormat'
import { DocumentLink } from '@/shared/ui/DocumentLink'
import type { SupplierSupply } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'

const timingText = {
  within: 'Враховано в плані', later: 'Після планового періоду', overdue: 'Дата минула', undated: 'Строк не вказано',
  review: 'Стан або приймання потребує звірки', units: 'Звірити одиниці виміру', 'other-store': 'Інший склад або організація',
}

export function SupplierOrders({ supply, unit }: { supply: SupplierSupply; unit: string | null }) {
  if (!supply.orders.length) return <span className="app-cell-sub">Відкритих замовлень у реєстрі не знайдено</span>
  const totals = new Map<string, number>()
  for (const order of supply.orders) totals.set(order.unit, (totals.get(order.unit) ?? 0) + order.ordered)
  const ordered = [...totals].map(([u, qty]) => numberFormat.format(qty) + ' ' + u).join(', ')
  const next = supply.orders.find(o => o.timing === 'within' || o.timing === 'later')
  return <details className="app-cell-sub">
    <summary>Замовлено за документами · {ordered}. {next?.eta ? 'Очікуємо ' + dateLabel(next.eta) : 'Дату надходження слід уточнити'}</summary>
    <div>Підтверджено до отримання · {numberFormat.format(supply.confirmed)} {unit} · з них відправлено {numberFormat.format(supply.inTransit)} {unit}</div>
    {supply.orders.map((o, index) => <div key={o.id + '-' + index}>
      <DocumentLink id={o.id}>Замовлення №{o.number || '—'} від {dateLabel(o.day)}</DocumentLink>
      <div>Замовлено {numberFormat.format(o.ordered)} {o.unit} · прийнято за зв’язаними накладними {o.received == null ? '—' : numberFormat.format(o.received) + ' ' + o.unit} · залишилось {o.remaining == null ? '—' : numberFormat.format(o.remaining) + ' ' + o.unit}</div>
      <div>{o.eta ? 'Планове надходження ' + dateLabel(o.eta) : 'Планову дату не вказано'} · {timingText[o.timing]}</div>
    </div>)}
  </details>
}
