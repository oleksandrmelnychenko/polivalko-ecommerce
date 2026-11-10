import { Button } from '@mantine/core'
import { IconReceiptRefund } from '@tabler/icons-react'
import { useState } from 'react'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { refundStatusLabel } from '@polivalko/shared/lib/labels'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { TableChip } from '@/shared/ui/TableChip'
import type { ConsoleOrder, OrderRefund } from '../api/orderDetailApi'
import { outcomeTone } from '../lib/orderDetail'
import { useRefund } from '../lib/useRefund'
import { OrderCard, OrderCardBody, OrderCardNote } from './OrderCard'
import { OrderRefundForm } from './OrderRefundForm'

export function OrderRefundsCard({ order, onChange }: { order: ConsoleOrder; onChange: (order: ConsoleOrder) => void }) {
  const { can } = usePermissions()
  const [open, setOpen] = useState(false)
  const refund = useRefund(order, (next) => {
    onChange(next)
    setOpen(false)
  })
  const canRefund = can(PermissionKeys.Orders.CreateRefund)
  const formAvailable = canRefund && Boolean(order.refundMethod) && order.refundable.length > 0
  const hasRefunds = order.refunds.length > 0

  if (!hasRefunds && !canRefund) return null

  const aside = (
    <>
      {hasRefunds ? (
        <span className="order-card-meta">
          повернено <span className="money">{formatMoney(order.refundedAmount)}</span> з <span className="money">{formatMoney(order.total)}</span>
        </span>
      ) : null}
      {formAvailable && !open ? (
        <Button size="compact-sm" variant="default" leftSection={<IconReceiptRefund size={15} stroke={1.8} />} onClick={() => setOpen(true)}>
          Оформити повернення
        </Button>
      ) : null}
    </>
  )

  return (
    <OrderCard className="order-area-refunds order-no-print" title="Повернення" aside={aside}>
      {hasRefunds ? (
        <ul className="order-refunds">
          {order.refunds.map((row) => (
            <RefundRow key={row.id} row={row} />
          ))}
        </ul>
      ) : null}

      {formAvailable && open ? (
        <OrderCardBody className={hasRefunds ? 'order-card-body--split' : undefined}>
          <OrderRefundForm order={order} refund={refund} onCancel={() => {
            refund.reset()
            setOpen(false)
          }} />
        </OrderCardBody>
      ) : null}

      {!hasRefunds && !open ? (
        <OrderCardNote>
          {formAvailable
            ? 'Повернень ще не було.'
            : 'Повернути можна оплачене онлайн замовлення або виконане замовлення з оплатою під час отримання.'}
        </OrderCardNote>
      ) : null}
    </OrderCard>
  )
}

function RefundRow({ row }: { row: OrderRefund }) {
  return (
    <li className="order-refund">
      <div className="order-refund-head">
        <span className="order-refund-amount money">−{formatMoney(row.amount)}</span>
        <TableChip tone={outcomeTone(row.status)} value={refundStatusLabel[row.status] ?? row.status} />
        <span className="order-refund-method">{row.method === 'provider' ? 'на картку покупця' : 'поза сайтом'}</span>
        <span className="order-refund-when">
          {formatDateTime(row.createdAt)} · {row.requestedBy}
        </span>
      </div>
      <ul className="order-refund-lines">
        {row.lines.map((line) => (
          <li key={line.productId}>
            <span className="order-refund-line-name">{line.name}</span>
            <span className="order-refund-line-qty">× {line.quantity}</span>
            <span className="order-refund-line-sum money">{formatMoney(line.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="order-refund-reason">
        <span>Причина</span>
        {row.reason}
      </p>
      {row.error ? (
        <p className="order-refund-error" role="alert">
          {row.error}
        </p>
      ) : null}
    </li>
  )
}
