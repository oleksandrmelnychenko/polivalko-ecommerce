import { Button, Select } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import type { OrderStatus } from '@polivalko/shared/api/types'
import { orderStatusLabel } from '@polivalko/shared/lib/labels'
import { ListPageFooter } from '@/shared/ui/ListPage'

const TARGET_STATUSES = (Object.keys(orderStatusLabel) as OrderStatus[])
  .filter((status) => status !== 'new')
  .map((status) => ({ value: status, label: orderStatusLabel[status] }))

type OrdersBulkBarProps = {
  count: number
  status: OrderStatus | null
  busy: boolean
  onStatus: (status: OrderStatus | null) => void
  onApply: () => void
  onClear: () => void
}

export function OrdersBulkBar({ count, status, busy, onStatus, onApply, onClear }: OrdersBulkBarProps) {
  return (
    <ListPageFooter>
      <div className="orders-bulk-bar" role="region" aria-label="Дії з вибраними замовленнями">
        <span className="orders-bulk-count">
          Вибрано: <b>{count}</b>
        </span>
        <Select
          aria-label="Новий статус"
          placeholder="Змінити статус на…"
          data={TARGET_STATUSES}
          value={status}
          disabled={busy}
          size="sm"
          w={240}
          comboboxProps={{ position: 'top-start' }}
          onChange={(value) => onStatus(value as OrderStatus | null)}
        />
        <Button size="sm" disabled={!status} loading={busy} onClick={onApply}>
          Застосувати
        </Button>
        <Button size="sm" variant="subtle" color="gray" leftSection={<IconX size={15} />} disabled={busy} onClick={onClear}>
          Зняти вибір
        </Button>
      </div>
    </ListPageFooter>
  )
}
