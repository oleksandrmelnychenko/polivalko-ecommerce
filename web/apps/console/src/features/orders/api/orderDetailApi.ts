import type { components } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'
import type { CsrfHeaders } from '@/shared/api/csrf'

export type ConsoleOrder = components['schemas']['ConsoleOrderDto']
export type OrderItem = components['schemas']['OrderItemDto']
export type OrderRefund = components['schemas']['ConsoleRefundDto']
export type OrderPayment = components['schemas']['ConsolePaymentDto']
export type OrderReceipt = components['schemas']['ReceiptDto']
export type CreateRefundRequest = components['schemas']['CreateRefundRequest']

export function getOrder(number: string) {
  return api.GET('/api/v1/console/orders/{number}', { params: { path: { number } } })
}

export function createRefund(headers: CsrfHeaders, number: string, idempotencyKey: string, body: CreateRefundRequest) {
  return api.POST('/api/v1/console/orders/{number}/refunds', {
    params: { path: { number }, header: { 'Idempotency-Key': idempotencyKey } },
    headers,
    body,
  })
}

export function getOrderPayments(number: string) {
  return api.GET('/api/v1/console/orders/{number}/payments', { params: { path: { number } } })
}

export function getOrderReceipts(number: string) {
  return api.GET('/api/v1/console/orders/{number}/receipts', { params: { path: { number } } })
}

export function saveOrderNote(headers: CsrfHeaders, number: string, note: string) {
  return api.PUT('/api/v1/console/orders/{number}/note', { params: { path: { number } }, headers, body: { note: note || null } })
}
