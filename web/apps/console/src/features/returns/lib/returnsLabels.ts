import { refundStatusLabel } from '@polivalko/shared/lib/labels'
import type { TableChipTone } from '@/shared/ui/TableChip'
import { REFUND_STATUSES, type RefundChannel } from '../api/returnsApi'

export const STATUS_OPTIONS = REFUND_STATUSES.map((value) => ({ value, label: refundStatusLabel[value] ?? value }))

export function methodLabel(method: RefundChannel): string {
  return method === 'card' ? 'На картку' : 'Поза сайтом'
}

const RECEIPT_LABELS: Record<string, string> = {
  pending: 'Видається',
  issued: 'Видано',
  failed: 'Помилка',
}

export function receiptLabel(status: string): string {
  return RECEIPT_LABELS[status] ?? status
}

export function receiptTone(status: string): TableChipTone {
  if (status === 'issued') return 'success'
  if (status === 'failed') return 'danger'
  return 'neutral'
}
