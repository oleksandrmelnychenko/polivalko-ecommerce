import { useMemo, useRef, useState, type FormEvent } from 'react'
import { newIdempotencyKey } from '@polivalko/shared/api/browser'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage, type Problem } from '@/shared/api/problem'
import { notifySummaryStale } from '@/shared/lib/events'
import { createRefund, getOrder, type ConsoleOrder } from '../api/orderDetailApi'

const LOST_RESPONSE = 'Відповідь сервера не надійшла. Картку оновлено, кількості скинуто: перевірте список повернень і, якщо цього повернення там немає, оформіть його ще раз.'
const CHECK_BEFORE_RETRY = 'Попередня спроба лишилася без відповіді. Картку оновлено, кількості скинуто: перевірте список повернень, тоді оформіть повернення ще раз.'
const STILL_RUNNING = 'Попередня спроба ще обробляється. Зачекайте кілька секунд і натисніть «Повернути» ще раз.'

type Attempt = { key: string; payload: string }

export function useRefund(order: ConsoleOrder, onChange: (order: ConsoleOrder) => void, onSynced: (order: ConsoleOrder) => void) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('')
  const [returnToStock, setReturnToStock] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const attempt = useRef<Attempt | null>(null)
  const unconfirmed = useRef(false)

  const refundable = useMemo(() => new Map(order.refundable.map((line) => [line.productId, line.quantity])), [order.refundable])
  const amount = order.items.reduce((sum, item) => sum + (quantities[item.productId] ?? 0) * Number(item.unitPrice.value), 0)
  const canSubmit = !busy && amount > 0 && reason.trim().length > 0

  function setQuantity(productId: string, value: number) {
    const max = refundable.get(productId) ?? 0
    setQuantities((current) => ({ ...current, [productId]: Math.max(0, Math.min(Math.floor(value) || 0, max)) }))
  }

  function reset() {
    setQuantities({})
    setReason('')
    setReturnToStock(true)
    setError(null)
  }

  async function sync(): Promise<boolean> {
    try {
      const fresh = await getOrder(order.number)
      if (!fresh.data) return false
      setQuantities({})
      onSynced(fresh.data)
      return true
    } catch {
      return false
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const lines = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => ({ productId, quantity }))
      .sort((a, b) => a.productId.localeCompare(b.productId))
    const body = { lines, reason: reason.trim(), returnToStock }
    const payload = JSON.stringify(body)
    try {
      if (unconfirmed.current && attempt.current?.payload !== payload) {
        if (await sync()) {
          unconfirmed.current = false
          setError(CHECK_BEFORE_RETRY)
        } else {
          setError(NETWORK_ERROR)
        }
        return
      }
      if (attempt.current?.payload !== payload) attempt.current = { key: newIdempotencyKey(), payload }
      const idempotencyKey = attempt.current.key
      const result = await withCsrf((headers) => createRefund(headers, order.number, idempotencyKey, body))
      unconfirmed.current = false
      if (result.data) {
        attempt.current = null
        setQuantities({})
        setReason('')
        setReturnToStock(true)
        onChange(result.data)
        notifySummaryStale()
      } else {
        const problem = result.error as Problem | undefined
        if (problem?.code === 'idempotency.in_progress') setError(STILL_RUNNING)
        else setError(problem?.errors ? Object.values(problem.errors).flat().join(' ') : problemMessage(problem, 'Повернення не оформлено.'))
      }
    } catch {
      unconfirmed.current = true
      if (await sync()) {
        unconfirmed.current = false
        setError(LOST_RESPONSE)
      } else {
        setError(NETWORK_ERROR)
      }
    } finally {
      setBusy(false)
    }
  }

  return { quantities, setQuantity, reason, setReason, returnToStock, setReturnToStock, busy, error, refundable, amount, canSubmit, submit, reset }
}

export type OrderRefundState = ReturnType<typeof useRefund>
