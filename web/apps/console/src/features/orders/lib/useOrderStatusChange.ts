import { useState } from 'react'
import type { OrderStatus } from '@polivalko/shared/api/types'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { notifySummaryStale } from '@/shared/lib/events'
import type { ConsoleOrder } from '../api/orderDetailApi'
import { changeOrderStatus } from '../api/ordersApi'

export function useOrderStatusChange(number: string, onChanged: (order: ConsoleOrder) => void) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<OrderStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function change(status: OrderStatus) {
    setBusy(status)
    setError(null)
    try {
      const result = await withCsrf((headers) => changeOrderStatus(headers, number, { status, reason: reason.trim() || null }))
      if (result.data) {
        onChanged(result.data)
        setReason('')
        notifySummaryStale()
      } else {
        setError(problemMessage(result.error, 'Статус не змінено.'))
      }
    } catch {
      setError(NETWORK_ERROR)
    } finally {
      setBusy(null)
    }
  }

  return { reason, setReason, busy, error, change }
}

export type OrderStatusChange = ReturnType<typeof useOrderStatusChange>
