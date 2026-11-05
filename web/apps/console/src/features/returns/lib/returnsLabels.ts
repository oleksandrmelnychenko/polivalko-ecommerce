import { refundStatusLabel } from '@polivalko/shared/lib/labels'
import type { TableChipTone } from '@/shared/ui/TableChip'
import { REFUND_STATUSES, type RefundChannel } from '../api/returnsApi'

export const STATUS_OPTIONS = REFUND_STATUSES.map((value) => ({ value, label: refundStatusLabel[value] ?? value }))

const METHOD_LABELS: Record<RefundChannel, string> = {
  card: 'на картку',
  offline: 'поза сайтом',
}

const RECEIPT_LABELS: Record<string, string> = {
  pending: 'Видається',
  issued: 'Видано',
  failed: 'Помилка',
}

export function refundMethodLabel(method: RefundChannel): string {
  return METHOD_LABELS[method] ?? method
}

export function refundTone(status: string): TableChipTone {
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'danger'
  return 'warning'
}

export function receiptLabel(status: string): string {
  return RECEIPT_LABELS[status] ?? status
}

export function receiptTone(status: string): TableChipTone {
  if (status === 'issued') return 'success'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

export function orderHref(number: string): string {
  return `/sales/orders/${encodeURIComponent(number)}`
}
