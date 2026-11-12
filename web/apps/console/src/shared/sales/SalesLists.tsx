import type { Money as MoneyValue, OrderStatus } from '@polivalko/shared/api/types'
import { refundStatusLabel } from '@polivalko/shared/lib/labels'
import { Link } from 'react-router-dom'
import { shortWhen } from '@/shared/lib/when'
import { Money } from '@/shared/ui/Money'
import { OrderStatusChip } from '@/shared/ui/StatusChip'
import { TableChip, type TableChipTone } from '@/shared/ui/TableChip'
import { orderHref } from './salesLookups'
import './sales.css'

export type OrderLine = {
  number: string
  createdAt: string
  status: string
  total: MoneyValue
}

export type RefundLine = {
  id: string
  orderNumber: string
  createdAt: string
  status: string
  amount: MoneyValue
}

export function refundTone(status: string): TableChipTone {
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'danger'
  return 'warning'
}

function OrderNumber({ number, canOpen }: { number: string; canOpen: boolean }) {
  return canOpen ? (
    <Link className="app-sales-number" to={orderHref(number)}>
      {number}
    </Link>
  ) : (
    <span className="app-sales-number">{number}</span>
  )
}

export function OrdersList({ orders, canOpen, label }: { orders: readonly OrderLine[]; canOpen: boolean; label: string }) {
  return (
    <ul className="app-sales-list" aria-label={label}>
      {orders.map((order) => (
        <li key={order.number}>
          <OrderNumber number={order.number} canOpen={canOpen} />
          <span className="app-sales-when">{shortWhen(order.createdAt)}</span>
          <OrderStatusChip status={order.status as OrderStatus} />
          <span className="app-sales-sum">
            <Money value={order.total} />
          </span>
        </li>
      ))}
    </ul>
  )
}

export function RefundsList({ refunds, canOpen, activeId, label }: { refunds: readonly RefundLine[]; canOpen: boolean; activeId?: string; label: string }) {
  return (
    <ul className="app-sales-list" aria-label={label}>
      {refunds.map((refund) => (
        <li key={refund.id} className={refund.id === activeId ? 'is-active' : undefined}>
          <OrderNumber number={refund.orderNumber} canOpen={canOpen} />
          <span className="app-sales-when">{shortWhen(refund.createdAt)}</span>
          <TableChip dot tone={refundTone(refund.status)} value={refundStatusLabel[refund.status] ?? refund.status} />
          <span className="app-sales-sum">
            <Money value={refund.amount} />
          </span>
        </li>
      ))}
    </ul>
  )
}
