import { Button, SegmentedControl, Skeleton } from '@mantine/core'
import { IconArrowRight, IconPhone } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { plural } from '@polivalko/shared/lib/format'
import { serviceRequestStatusLabel } from '@polivalko/shared/lib/labels'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { moment } from '@/shared/lib/when'
import { findOrders, ordersSearchHref } from '@/shared/sales/salesLookups'
import { OrdersList } from '@/shared/sales/SalesLists'
import { SplitAvatar } from '@/shared/ui/split/SplitAvatar'
import { RequestStatusChip } from '@/shared/ui/StatusChip'
import { REQUEST_STATUSES, type RequestStatus, type ServiceRequest } from '../api/requestsApi'
import { isRequestStatus } from '../lib/useRequestsState'

const STATUS_OPTIONS = REQUEST_STATUSES.map((value) => ({ value, label: serviceRequestStatusLabel[value] ?? value }))
const ORDERS_SHOWN = 5

type RequestDetailPaneProps = {
  request: ServiceRequest | null
  canChange: boolean
  canViewOrders: boolean
  pendingStatus: RequestStatus | undefined
  onChangeStatus: (request: ServiceRequest, status: RequestStatus) => void
}

export function RequestDetailPane({ request, canChange, canViewOrders, pendingStatus, onChangeStatus }: RequestDetailPaneProps) {
  const orders = useApiQuery(`request-orders:${request?.phone ?? ''}`, () => findOrders(request?.phone ?? '', ORDERS_SHOWN), { enabled: Boolean(request) && canViewOrders })

  if (!request) return <section className="app-split-detail app-split-detail-empty">Оберіть заявку зліва.</section>

  const received = moment(request.createdAt)
  const orderItems = orders.isFetching ? [] : (orders.data?.items ?? [])
  const orderCount = orders.isFetching ? 0 : (orders.data?.totalItems ?? 0)

  return (
    <section key={request.id} className="app-split-detail" aria-labelledby="request-detail-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <SplitAvatar name={request.name} size="lg" muted={request.status === 'done'} />
            <div className="app-split-hero-main">
              <p className="app-split-hero-kicker">Заявка на послугу</p>
              <h2 id="request-detail-title">
                {request.name}
                <RequestStatusChip status={request.status} />
              </h2>
              <p className="app-split-hero-aliases">
                <a href={`tel:${request.phone}`}>{request.phone}</a>
                <span className="app-split-dot">{request.directionName}</span>
              </p>
            </div>
          </div>
          <div className="app-split-actions">
            <Button component="a" href={`tel:${request.phone}`} variant="default" leftSection={<IconPhone size={16} stroke={1.7} />}>
              Подзвонити
            </Button>
          </div>
        </div>

        <dl className="app-split-stats is-text">
          <div>
            <dt>Отримано</dt>
            <dd>
              {received.day}
              <small>о {received.time}</small>
            </dd>
          </div>
          <div>
            <dt>Напрямок</dt>
            <dd>
              {request.directionName}
              <small className="app-split-mono">{request.directionCode}</small>
            </dd>
          </div>
          <div>
            <dt>{canViewOrders ? 'Замовлення з номера' : 'Телефон'}</dt>
            <dd>
              {!canViewOrders ? (
                request.phone
              ) : orders.isFetching ? (
                '…'
              ) : orderCount ? (
                <>
                  {orderCount}
                  <small>{plural(orderCount, 'замовлення', 'замовлення', 'замовлень')} на сайті</small>
                </>
              ) : (
                <span className="app-split-value-empty">немає</span>
              )}
            </dd>
          </div>
        </dl>

        {canChange ? (
          <div className="app-split-bar">
            <span className="app-split-bar-label">Статус заявки</span>
            <SegmentedControl
              size="sm"
              data={STATUS_OPTIONS}
              value={pendingStatus ?? request.status}
              disabled={pendingStatus !== undefined}
              onChange={(value) => {
                if (isRequestStatus(value) && value !== request.status) onChangeStatus(request, value)
              }}
            />
          </div>
        ) : null}
      </header>

      <section className="app-split-card" aria-labelledby="request-comment-title">
        <header className="app-split-card-head">
          <h3 id="request-comment-title">Коментар клієнта</h3>
        </header>
        {request.comment ? <p className="app-split-text">{request.comment}</p> : <p className="app-split-blank">Клієнт не залишив коментаря.</p>}
      </section>

      {canViewOrders ? (
        <section className="app-split-card" aria-labelledby="request-orders-title">
          <header className="app-split-card-head">
            <h3 id="request-orders-title">Замовлення з цього номера</h3>
            {orderCount > 0 ? (
              <Link to={ordersSearchHref(request.phone)}>
                {orderCount > ORDERS_SHOWN ? `Усі ${orderCount}` : 'У замовленнях'}
                <IconArrowRight size={14} stroke={2} aria-hidden="true" />
              </Link>
            ) : null}
          </header>
          {orders.isFetching ? (
            <Skeleton height={88} radius={8} />
          ) : orderItems.length ? (
            <OrdersList orders={orderItems} canOpen label="Замовлення з цього номера" />
          ) : (
            <p className="app-split-blank">З цього номера замовлень на сайті не було.</p>
          )}
        </section>
      ) : null}
    </section>
  )
}
