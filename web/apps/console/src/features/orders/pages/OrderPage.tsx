import { Button } from '@mantine/core'
import { IconChevronRight, IconPhone, IconPrinter } from '@tabler/icons-react'
import { Link, useParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { getOrder } from '../api/orderDetailApi'
import { OrderAccountingCard } from '../components/OrderAccountingCard'
import { OrderBuyerCard } from '../components/OrderBuyerCard'
import { OrderHero } from '../components/OrderHero'
import { OrderHistoryCard } from '../components/OrderHistoryCard'
import { OrderItemsCard } from '../components/OrderItemsCard'
import { OrderNoteCard } from '../components/OrderNoteCard'
import { OrderOthersCard } from '../components/OrderOthersCard'
import { OrderPaymentsCard } from '../components/OrderPaymentsCard'
import { OrderReceiptsCard } from '../components/OrderReceiptsCard'
import { OrderRefundsCard } from '../components/OrderRefundsCard'
import { OrderStatusPanel } from '../components/OrderStatusPanel'
import { usePrintedAt } from '../lib/orderDetail'
import { useOrderStatusChange } from '../lib/useOrderStatusChange'
import './order.css'
import './order-print.css'

export function OrderPage() {
  const { number = '' } = useParams()
  return <OrderDetail key={number} number={number} />
}

function OrderDetail({ number }: { number: string }) {
  const order = useApiQuery(`order:${number}`, () => getOrder(number))
  const status = useOrderStatusChange(number, order.setData)
  const printedAt = usePrintedAt()
  const { can } = usePermissions()
  const data = order.data

  const header = (
    <PageHeader
      title={`Замовлення ${number}`}
      heading={
        <nav className="order-crumbs" aria-label="Хлібні крихти">
          <Link to="/sales/orders">Замовлення</Link>
          <IconChevronRight size={14} stroke={1.8} aria-hidden="true" />
          <span aria-current="page">{number}</span>
        </nav>
      }
      actions={
        data ? (
          <>
            <Button component="a" href={`tel:${data.phone}`} variant="default" leftSection={<IconPhone size={16} stroke={1.8} />}>
              Подзвонити
            </Button>
            <Button variant="default" leftSection={<IconPrinter size={16} stroke={1.8} />} onClick={() => window.print()}>
              Друк
            </Button>
          </>
        ) : null
      }
    />
  )

  if (!data) {
    return (
      <>
        {header}
        {order.status === 'loading' ? (
          <PageState kind="loading" />
        ) : (
          <PageState
            kind={order.status === 'forbidden' ? 'forbidden' : 'error'}
            title={order.problem?.title}
            description={order.problem?.detail ?? 'Перевірте, що API працює, і спробуйте ще раз.'}
            onRetry={order.status === 'forbidden' ? undefined : order.reload}
          />
        )}
      </>
    )
  }

  const version = `${data.paymentStatus}-${data.refunds.length}-${data.status}`

  return (
    <div className="order-page">
      {header}
      <OrderHero order={data} printedAt={printedAt} />
      <div className="order-layout">
        <div className="order-col">
          <OrderItemsCard order={data} />
          <OrderHistoryCard order={data} />
          <OrderRefundsCard order={data} onChange={order.setData} />
          <OrderPaymentsCard number={data.number} version={version} />
          <OrderReceiptsCard number={data.number} version={version} />
        </div>
        <div className="order-col order-col-side">
          {can(PermissionKeys.Orders.ChangeStatus) ? <OrderStatusPanel order={data} status={status} /> : null}
          <OrderNoteCard order={data} onSaved={order.setData} />
          <OrderBuyerCard order={data} />
          <OrderOthersCard phone={data.phone} current={data.number} />
          <OrderAccountingCard order={data} />
        </div>
      </div>
    </div>
  )
}
