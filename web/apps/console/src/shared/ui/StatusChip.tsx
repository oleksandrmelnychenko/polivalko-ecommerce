import type { OrderStatus, PaymentStatus } from '@polivalko/shared/api/types'
import { orderStatusLabel, paymentStatusLabel, serviceRequestStatusLabel } from '@polivalko/shared/lib/labels'
import { orderStatusTone, paymentStatusTone, requestStatusTone } from './statusTones'
import { TableChip } from './TableChip'

type ChipSize = { size?: 'md' | 'lg' }

export function OrderStatusChip({ status, size }: { status: OrderStatus } & ChipSize) {
  return <TableChip dot size={size} tone={orderStatusTone[status]} value={orderStatusLabel[status] ?? status} />
}

export function PaymentStatusChip({ status, size }: { status: PaymentStatus } & ChipSize) {
  return <TableChip size={size} tone={paymentStatusTone[status]} value={paymentStatusLabel[status] ?? status} />
}

export function RequestStatusChip({ status, size }: { status: string } & ChipSize) {
  return <TableChip dot size={size} tone={requestStatusTone[status] ?? 'neutral'} value={serviceRequestStatusLabel[status] ?? status} />
}
