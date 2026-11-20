import { IconClipboardCheck, IconCreditCard, IconInbox, IconShoppingBag } from '@tabler/icons-react'
import type { OrderStatus } from '@polivalko/shared/api/types'
import { orderStatusLabel } from '@polivalko/shared/lib/labels'
import { MetricLabel, MetricTrack } from '@/shared/ui/MetricCard'
import type { OrderCounts } from '../api/ordersApi'

const primary = [
  { value: '', label: 'Усі замовлення', icon: IconShoppingBag },
  { value: 'new', label: 'Нові', icon: IconInbox },
  { value: 'awaitingConfirmation', label: 'Очікують підтвердження', icon: IconClipboardCheck },
  { value: 'awaitingPayment', label: 'Очікують оплати', icon: IconCreditCard },
] as const
const remaining = (Object.keys(orderStatusLabel) as OrderStatus[]).filter((value) => !primary.some((card) => card.value === value))
const countFormat = new Intl.NumberFormat('uk-UA')

export function OrdersStatusTabs({ status, counts, onChange }: { status: string; counts?: OrderCounts; onChange: (status: string) => void }) {
  const countOf = (value: OrderStatus | '') => value ? counts?.byStatus.find((entry) => entry.status === value)?.count ?? 0 : counts?.all ?? 0
  return (
    <div className="orders-status-picker" role="group" aria-label="Статус замовлення">
      <div className="orders-status-cards">
        {primary.map(({ value, label, icon }) => (
          <button key={value} type="button" className="orders-status-card" aria-pressed={status === value} onClick={() => onChange(value)}>
            <MetricLabel icon={icon}>{label}</MetricLabel>
            <strong>{counts ? countFormat.format(countOf(value)) : '—'}</strong>
            <MetricTrack value={countOf(value)} max={counts?.all ?? 0} />
          </button>
        ))}
      </div>
      <div className="orders-status-options">
        {remaining.map((value) => (
          <button key={value} type="button" aria-pressed={status === value} onClick={() => onChange(value)}>
            {orderStatusLabel[value]} <span>{counts ? countFormat.format(countOf(value)) : '—'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
