import { IconReceipt2, IconShoppingBag, IconUsers, IconWallet } from '@tabler/icons-react'
import { formatMoney } from '@polivalko/shared/lib/format'
import type { Dashboard } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'
import { DeltaChip } from './DeltaChip'

export function KpiList({ data }: { data: Dashboard }) {
  const { current: c, previous: p } = data
  const kpis = [
    {
      label: 'Виручка',
      icon: IconWallet,
      value: <span className="money">{formatMoney(c.revenue)}</span>,
      delta: <DeltaChip current={Number(c.revenue.value)} previous={Number(p.revenue.value)} />,
      foot: <>було <span className="money">{formatMoney(p.revenue)}</span></>,
    },
    {
      label: 'Замовлення',
      icon: IconShoppingBag,
      value: numberFormat.format(c.orders),
      delta: <DeltaChip current={c.orders} previous={p.orders} />,
      foot: c.cancelled ? `скасовано ${c.cancelled}` : `було ${p.orders}`,
    },
    {
      label: 'Середній чек',
      icon: IconReceipt2,
      value: <span className="money">{formatMoney(c.averageOrder)}</span>,
      delta: <DeltaChip current={Number(c.averageOrder.value)} previous={Number(p.averageOrder.value)} />,
      foot: <>було <span className="money">{formatMoney(p.averageOrder)}</span></>,
    },
    {
      label: 'Покупці',
      icon: IconUsers,
      value: numberFormat.format(c.customers),
      delta: <DeltaChip current={c.customers} previous={p.customers} />,
      foot: `було ${p.customers}`,
    },
  ]

  return (
    <ul className="dash-kpis">
      {kpis.map(({ label, icon: Icon, value, delta, foot }) => (
        <li key={label} className="dash-kpi">
          <span className="dash-kpi-label">
            <Icon size={16} stroke={1.7} aria-hidden="true" />
            {label}
          </span>
          <span className="dash-kpi-value">{value}</span>
          <span className="dash-kpi-foot">
            {delta}
            <span>{foot}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
