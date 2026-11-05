import type { OrderStatus } from '@polivalko/shared/api/types'
import { orderStatusLabel } from '@polivalko/shared/lib/labels'
import { ScreenTabs, type ScreenTab } from '@/shared/ui/ScreenTabs'
import type { OrderCounts } from '../api/ordersApi'

const STATUSES = Object.keys(orderStatusLabel) as OrderStatus[]
const HOT: readonly OrderStatus[] = ['new', 'awaitingConfirmation']

type TabValue = OrderStatus | 'all'

export function OrdersStatusTabs({ status, counts, onChange }: { status: string; counts?: OrderCounts; onChange: (status: string) => void }) {
  const countOf = (value: OrderStatus) => (counts ? counts.byStatus.find((entry) => entry.status === value)?.count ?? 0 : null)
  const tabs: ScreenTab<TabValue>[] = [
    { value: 'all', label: 'Усі', count: counts ? counts.all : null },
    ...STATUSES.map((value) => ({ value, label: orderStatusLabel[value], count: countOf(value), hot: HOT.includes(value) })),
  ]

  return <ScreenTabs<TabValue> label="Статус замовлення" tabs={tabs} value={(status || 'all') as TabValue} onChange={(value) => onChange(value === 'all' ? '' : value)} />
}
