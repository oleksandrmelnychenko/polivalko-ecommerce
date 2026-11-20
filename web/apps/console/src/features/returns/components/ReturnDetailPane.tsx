import { Button, Skeleton } from '@mantine/core'
import { IconArrowUpRight, IconHistory, IconReceiptRefund, IconShoppingBag } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import type { OrderStatus } from '@polivalko/shared/api/types'
import { formatDateTime, formatMoney, formatPrice } from '@polivalko/shared/lib/format'
import { deliveryMethodLabel, refundStatusLabel } from '@polivalko/shared/lib/labels'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { findOrders, findRefunds, orderHref } from '@/shared/sales/salesLookups'
import { RefundsList, refundTone } from '@/shared/sales/SalesLists'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { Money } from '@/shared/ui/Money'
import { OrderStatusChip, PaymentStatusChip } from '@/shared/ui/StatusChip'
import { TableChip } from '@/shared/ui/TableChip'
import type { RefundRow } from '../api/returnsApi'
import { methodLabel, receiptLabel, receiptTone } from '../lib/returnsLabels'

export function ReturnDetailPane({ refund, opened, onClose }: { refund: RefundRow; opened: boolean; onClose: () => void }) {
  const number = refund.orderNumber
  const orders = useApiQuery(`return-order:${number}`, () => findOrders(number, 5), { enabled: opened })
  const history = useApiQuery(`return-siblings:${number}`, () => findRefunds(number, 50), { enabled: opened })
  const order = orders.data?.items.find((item) => item.number === number)
  const related = history.data?.items.filter((item) => item.orderNumber === number) ?? []
  const complete = history.status === 'ready' && history.data && history.data.items.length === history.data.totalItems
  const returned = related.filter((item) => item.status === 'succeeded').reduce((sum, item) => sum + Number(item.amount.value), 0)

  return (
    <AppEditorModal
      opened={opened} onClose={onClose} size="standard" className="return-modal"
      title={<MetricLabel icon={IconReceiptRefund}>Повернення · {number}</MetricLabel>}
      footer={<Button component={Link} to={orderHref(number)} variant="default" radius="xl" rightSection={<IconArrowUpRight size={16} />}>Відкрити замовлення</Button>}
    >
      <div className="return-panels">
        <section className="return-panel" aria-label="Деталі повернення">
          <div className="return-summary"><span>Сума повернення</span>
            <strong>{formatMoney(refund.amount)}</strong>
            <TableChip dot tone={refundTone(refund.status)} value={refundStatusLabel[refund.status]} />
          </div>
          <dl className="return-facts">
            <div><dt>Оформлено</dt><dd className="return-number">{formatDateTime(refund.createdAt)}</dd></div>
            <div><dt>Оформив</dt><dd>{refund.createdBy || 'Не вказано'}</dd></div>
            <div><dt>Спосіб повернення</dt><dd>{methodLabel(refund.method)}</dd></div>
            <div><dt>Чек повернення</dt><dd>{refund.receiptStatus ? <TableChip tone={receiptTone(refund.receiptStatus)} value={receiptLabel(refund.receiptStatus)} /> : 'Немає'}</dd></div>
            <div className="return-reason"><dt>Причина</dt><dd>{refund.reason || 'Не вказано'}</dd></div>
          </dl>
        </section>
        <section className="return-panel" aria-label="Замовлення">
          <h3><MetricLabel icon={IconShoppingBag}>Замовлення</MetricLabel></h3>
          {orders.isFetching ? <Skeleton height={100} /> : orders.status !== 'ready' ? (
            <div>Не вдалося завантажити замовлення. <Button variant="subtle" size="xs" onClick={orders.reload}>Повторити</Button></div>
          ) : order ? (
            <dl className="return-facts">
              <div><dt>Покупець</dt><dd>{order.customerName}<br /><a className="return-number" href={`tel:${order.phone}`}>{order.phone}</a></dd></div>
              <div><dt>Сума замовлення</dt><dd><Money value={order.total} /></dd></div>
              <div><dt>Оформлено</dt><dd className="return-number">{formatDateTime(order.createdAt)}</dd></div>
              <div><dt>Отримання</dt><dd>{deliveryMethodLabel[order.deliveryMethod] ?? order.deliveryMethod}</dd></div>
              <div className="return-reason"><dt>Стан замовлення й оплати</dt><dd className="return-chips"><OrderStatusChip status={order.status as OrderStatus} /><PaymentStatusChip status={order.paymentStatus} /></dd></div>
            </dl>
          ) : <p>Замовлення {number} не знайдено.</p>}
        </section>
        <section className="return-panel return-history">
          <h3><MetricLabel icon={IconHistory}>Повернення за цим замовленням</MetricLabel></h3>
          {history.isFetching ? <Skeleton height={60} /> : history.status !== 'ready' ? (
            <div>Не вдалося завантажити історію. <Button variant="subtle" size="xs" onClick={history.reload}>Повторити</Button></div>
          ) : <>
            {complete && related.length > 0 && <p>Повернуто <strong className="return-number">{formatPrice(returned)}</strong>{order && orders.status === 'ready' ? ` з ${formatMoney(order.total)}` : ''}</p>}
            <RefundsList refunds={related.length ? related : [refund]} canOpen activeId={refund.id} label="Повернення за цим замовленням" />
            {!complete && <Link to={`/sales/returns?q=${encodeURIComponent(number)}`}>Усі повернення за замовленням</Link>}
          </>}
        </section>
      </div>
    </AppEditorModal>
  )
}
