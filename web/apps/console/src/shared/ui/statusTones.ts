import type { OrderStatus, PaymentStatus } from '@polivalko/shared/api/types'
import type { TableChipTone } from './TableChip'

export const orderStatusTone: Record<OrderStatus, TableChipTone> = {
  new: 'warning',
  awaitingConfirmation: 'warning',
  confirmed: 'document',
  awaitingPayment: 'source',
  paid: 'success',
  shipped: 'product',
  readyForPickup: 'storage',
  completed: 'neutral',
  cancelled: 'danger',
}

export const paymentStatusTone: Record<PaymentStatus, TableChipTone> = {
  notRequired: 'neutral',
  pending: 'source',
  succeeded: 'success',
  failed: 'danger',
  partiallyRefunded: 'warning',
  refunded: 'neutral',
}

export const requestStatusTone: Record<string, TableChipTone> = {
  new: 'warning',
  inProgress: 'document',
  done: 'success',
}
