import { Button, SegmentedControl, Skeleton } from '@mantine/core'
import { IconArrowUpRight, IconCalendar, IconChecklist, IconClipboardList, IconMessage, IconPhone, IconShoppingBag, IconTools } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { serviceRequestStatusLabel } from '@polivalko/shared/lib/labels'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { moment } from '@/shared/lib/when'
import { findOrders, ordersSearchHref } from '@/shared/sales/salesLookups'
import { OrdersList } from '@/shared/sales/SalesLists'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { SplitAvatar } from '@/shared/ui/split/SplitAvatar'
import { RequestStatusChip } from '@/shared/ui/StatusChip'
import { REQUEST_STATUSES, type RequestStatus, type ServiceRequest } from '../api/requestsApi'
import { isRequestStatus } from '../lib/useRequestsState'

const STATUS_OPTIONS = REQUEST_STATUSES.map((value) => ({ value, label: serviceRequestStatusLabel[value] }))
const ORDERS_SHOWN = 5

type Props = {
  opened: boolean
  onClose: () => void
  request: ServiceRequest
  canChange: boolean
  canViewOrders: boolean
  pendingStatus?: RequestStatus
  onChangeStatus: (request: ServiceRequest, status: RequestStatus) => void
}

export function RequestDetailPane({ opened, onClose, request, canChange, canViewOrders, pendingStatus, onChangeStatus }: Props) {
  const orders = useApiQuery(`request-orders:${request.phone}`, () => findOrders(request.phone, ORDERS_SHOWN), { enabled: opened && canViewOrders })
  const received = moment(request.createdAt)
  const failed = orders.status === 'error' || orders.status === 'forbidden'
  const count = orders.data?.totalItems ?? 0
  const busy = pendingStatus !== undefined

  return (
    <AppEditorModal opened={opened} title={<MetricLabel icon={IconClipboardList}>Заявка на послугу</MetricLabel>} size="standard" className="request-modal" onClose={onClose}
      closeOnEscape={!busy} closeOnClickOutside={!busy}>
      <div className="request-details">
        <section className="request-panel request-contact" aria-label="Клієнт">
          <SplitAvatar name={request.name} size="lg" muted={request.status === 'done'} />
          <div className="request-identity">
            <h2>{request.name}</h2>
            <a className="request-number" href={`tel:${request.phone}`}>{request.phone}</a>
          </div>
          <Button component="a" href={`tel:${request.phone}`} radius="xl" variant="default" leftSection={<IconPhone size={16} />}>Подзвонити</Button>
        </section>

        <dl className="request-facts">
          <div className="request-panel">
            <dt><MetricLabel icon={IconTools}>Послуги</MetricLabel></dt>
            <dd>{request.directionNames?.join(', ') || request.directionName}</dd>
          </div>
          <div className="request-panel">
            <dt><MetricLabel icon={IconCalendar}>Отримано</MetricLabel></dt>
            <dd>{received.day}<small className="request-number">{received.time}</small></dd>
          </div>
        </dl>

        <section className="request-panel request-state" aria-label="Статус заявки">
          <h3><MetricLabel icon={IconChecklist}>Статус заявки</MetricLabel></h3>
          {canChange ? (
            <SegmentedControl size="sm" radius="xl" aria-label="Статус заявки" data={STATUS_OPTIONS}
              value={pendingStatus ?? request.status} disabled={busy}
              onChange={(value) => { if (isRequestStatus(value) && value !== request.status) onChangeStatus(request, value) }}
            />
          ) : <RequestStatusChip status={request.status} />}
        </section>

        <section className="request-panel" aria-labelledby="request-comment-title">
          <h3 id="request-comment-title"><MetricLabel icon={IconMessage}>Коментар клієнта</MetricLabel></h3>
          <p className={request.comment ? 'request-comment' : 'request-muted'}>{request.comment || 'Клієнт не залишив коментаря.'}</p>
        </section>

        {canViewOrders && (
          <section className="request-panel" aria-labelledby="request-orders-title">
            <header className="request-orders-head">
              <h3 id="request-orders-title"><MetricLabel icon={IconShoppingBag}>Замовлення з цього номера</MetricLabel></h3>
              {orders.status === 'ready' && count > 0 && (
                <Button component={Link} variant="default" radius="xl" size="xs" to={ordersSearchHref(request.phone)} rightSection={<IconArrowUpRight size={14} />}>
                  {count > ORDERS_SHOWN ? `Усі ${count}` : 'У замовленнях'}
                </Button>
              )}
            </header>
            {orders.isFetching ? <Skeleton height={40} radius="md" /> : failed ? (
              <>
                <p className="request-muted">{problemMessage(orders.problem, 'Не вдалося завантажити замовлення з цього номера.')}</p>
                {orders.status === 'error' && <Button size="xs" radius="xl" variant="default" onClick={orders.reload}>Спробувати ще раз</Button>}
              </>
            ) : orders.data?.items.length ? <OrdersList orders={orders.data.items} canOpen label="Замовлення з цього номера" />
              : <p className="request-muted">З цього номера замовлень на сайті не було.</p>}
          </section>
        )}
      </div>
    </AppEditorModal>
  )
}
