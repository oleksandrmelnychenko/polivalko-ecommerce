import { useState } from 'react'
import type { OrderStatus } from '@polivalko/shared/api/types'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { notifySummaryStale } from '@/shared/lib/events'
import { getOrder, type ConsoleOrder } from '../api/orderDetailApi'
import { changeOrderStatus } from '../api/ordersApi'
import { statusProblemText } from './statusProblem'

const CONFLICT_STATUS = 409

export function useOrderStatusChange(number: string, onChanged: (order: ConsoleOrder) => void) {
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState<OrderStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh(): Promise<boolean> {
    try {
      const fresh = await getOrder(number)
      if (!fresh.data) return false
      onChanged(fresh.data)
      return true
    } catch {
      return false
    }
  }

  async function change(status: OrderStatus, reason: string, options?: { returnToStock?: boolean }): Promise<boolean> {
    setBusy(status)
    setError(null)
    try {
      const payload = {
        status,
        reason: reason.trim() || null,
        ...(options?.returnToStock !== undefined ? { returnToStock: options.returnToStock } : {}),
      }
      const result = await withCsrf((headers) => changeOrderStatus(headers, number, payload))
      if (result.data) {
        onChanged(result.data)
        setComment('')
        notifySummaryStale()
        return true
      }
      if (result.response.status === CONFLICT_STATUS) {
        const refreshed = await refresh()
        notifySummaryStale()
        setError(
          `${statusProblemText(result.error, 'Статус не змінено.')} ${
            refreshed ? 'Картку оновлено: перевірте поточний статус і доступні дії.' : 'Оновіть сторінку, щоб побачити поточний статус.'
          }`,
        )
      } else {
        setError(problemMessage(result.error, 'Статус не змінено.'))
      }
    } catch {
      setError(NETWORK_ERROR)
    } finally {
      setBusy(null)
    }
    return false
  }

  function clearError() {
    setError(null)
  }

  return { comment, setComment, busy, error, clearError, change }
}

export type OrderStatusChange = ReturnType<typeof useOrderStatusChange>
