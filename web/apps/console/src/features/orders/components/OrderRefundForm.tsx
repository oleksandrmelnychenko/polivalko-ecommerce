import { Alert, Button, Textarea } from '@mantine/core'
import { IconAlertTriangle, IconInfoCircle, IconMinus, IconPlus, IconReceiptRefund } from '@tabler/icons-react'
import { formatMoney } from '@polivalko/shared/lib/format'
import type { ConsoleOrder } from '../api/orderDetailApi'
import type { OrderRefundState } from '../lib/useRefund'

const uah = (value: number) => formatMoney({ value: value.toFixed(2), currency: 'UAH' })

export function OrderRefundForm({ order, refund, onCancel }: { order: ConsoleOrder; refund: OrderRefundState; onCancel: () => void }) {
  const { quantities, setQuantity, reason, setReason, busy, error, refundable, amount, canSubmit, submit } = refund
  const lines = order.items.filter((item) => refundable.has(item.productId))
  const allPicked = lines.every((item) => (quantities[item.productId] ?? 0) === refundable.get(item.productId))

  function pickAll() {
    for (const item of lines) setQuantity(item.productId, allPicked ? 0 : (refundable.get(item.productId) ?? 0))
  }

  return (
    <form className="order-refund-form" onSubmit={(event) => void submit(event)} noValidate>
      <p className="order-refund-hint">
        <IconInfoCircle size={16} stroke={1.8} aria-hidden="true" />
        {order.refundMethod === 'provider'
          ? 'Платіжна система поверне кошти на картку покупця. Чек повернення сайт видасть автоматично.'
          : 'Повернення готівкою чи переказом поза сайтом. Сайт зафіксує його й видасть чек повернення, якщо продаж фіскалізував сайт.'}
      </p>

      <div className="order-refund-pick">
        <div className="order-refund-pick-head">
          <span>Що повертаємо</span>
          <Button variant="subtle" size="compact-xs" onClick={pickAll} disabled={busy}>
            {allPicked ? 'Очистити' : 'Усі товари'}
          </Button>
        </div>
        <ul>
          {lines.map((item) => {
            const max = refundable.get(item.productId) ?? 0
            const qty = quantities[item.productId] ?? 0
            const price = Number(item.unitPrice.value)
            return (
              <li key={item.productId} data-picked={qty > 0 || undefined}>
                <span className="order-refund-pick-text">
                  <span className="order-refund-pick-name">{item.name}</span>
                  <span className="order-refund-pick-sub">
                    <span className="money">{formatMoney(item.unitPrice)}</span> за шт. · можна до {max} шт.
                  </span>
                </span>
                <span className="order-qty" role="group" aria-label={`Скільки повернути: ${item.name}`}>
                  <button type="button" aria-label="Менше" disabled={busy || qty <= 0} onClick={() => setQuantity(item.productId, qty - 1)}>
                    <IconMinus size={14} stroke={2} />
                  </button>
                  <input
                    inputMode="numeric"
                    aria-label={`Кількість: ${item.name}`}
                    value={qty}
                    disabled={busy}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => setQuantity(item.productId, Number(event.currentTarget.value.replace(/\D/g, '')))}
                  />
                  <button type="button" aria-label="Більше" disabled={busy || qty >= max} onClick={() => setQuantity(item.productId, qty + 1)}>
                    <IconPlus size={14} stroke={2} />
                  </button>
                </span>
                <span className="order-refund-pick-sum money">{uah(qty * price)}</span>
              </li>
            )
          })}
        </ul>
      </div>

      <Textarea
        label="Причина повернення"
        placeholder="Наприклад: товар прийшов пошкодженим"
        value={reason}
        maxLength={500}
        required
        autosize
        minRows={2}
        maxRows={5}
        disabled={busy}
        onChange={(event) => setReason(event.currentTarget.value)}
      />

      {error ? (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
          {error}
        </Alert>
      ) : null}

      <div className="order-refund-actions">
        <span className="order-refund-total">
          До повернення <strong className="money">{uah(amount)}</strong>
        </span>
        <Button variant="default" onClick={onCancel} disabled={busy}>
          Скасувати
        </Button>
        <Button type="submit" leftSection={<IconReceiptRefund size={16} stroke={1.8} />} disabled={!canSubmit} loading={busy}>
          Повернути
        </Button>
      </div>
    </form>
  )
}
