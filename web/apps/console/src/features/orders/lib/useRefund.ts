import { useMemo, useRef, useState, type FormEvent } from 'react'
import { newIdempotencyKey } from '@polivalko/shared/api/browser'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage, type Problem } from '@/shared/api/problem'
import { notifySummaryStale } from '@/shared/lib/events'
import { createRefund, type ConsoleOrder } from '../api/orderDetailApi'

export function useRefund(order: ConsoleOrder, onChange: (order: ConsoleOrder) => void) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = useRef<string | null>(null)

  const refundable = useMemo(() => new Map(order.refundable.map((line) => [line.productId, line.quantity])), [order.refundable])
  const amount = order.items.reduce((sum, item) => sum + (quantities[item.productId] ?? 0) * Number(item.unitPrice.value), 0)
  const canSubmit = !busy && amount > 0 && reason.trim().length > 0

  function setQuantity(productId: string, value: number) {
    const max = refundable.get(productId) ?? 0
    setQuantities((current) => ({ ...current, [productId]: Math.max(0, Math.min(Math.floor(value) || 0, max)) }))
  }

  function reset() {
    setQuantities({})
    setReason("")
    setError(null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    key.current ??= newIdempotencyKey()
    const idempotencyKey = key.current
    const lines = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => ({ productId, quantity }))
    try {
      const result = await withCsrf((headers) => createRefund(headers, order.number, idempotencyKey, { lines, reason: reason.trim() }))
      if (result.data) {
        key.current = null
        setQuantities({})
        setReason('')
        onChange(result.data)
        notifySummaryStale()
      } else {
        const problem = result.error as Problem | undefined
        setError(problem?.errors ? Object.values(problem.errors).flat().join(' ') : problemMessage(problem, 'Повернення не оформлено.'))
      }
    } catch {
      setError(NETWORK_ERROR)
    } finally {
      setBusy(false)
    }
  }

  return { quantities, setQuantity, reason, setReason, busy, error, refundable, amount, canSubmit, submit, reset }
}

export type OrderRefundState = ReturnType<typeof useRefund>
