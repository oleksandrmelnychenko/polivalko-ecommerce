import { Link } from 'react-router-dom'
import { deliveryMethodLabel, paymentMethodLabel } from '@polivalko/shared/lib/labels'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import type { ConsoleOrder } from '../api/orderDetailApi'
import { OrderCard, OrderCardBody } from './OrderCard'

export function OrderBuyerCard({ order }: { order: ConsoleOrder }) {
  const { can } = usePermissions()
  const accountId = order.customerAccountId

  return (
    <OrderCard className="order-area-buyer" title="Покупець">
      <OrderCardBody>
        <dl className="order-facts">
          <div>
            <dt>Ім&apos;я</dt>
            <dd>
              <strong>{order.customerName}</strong>
            </dd>
          </div>
          <div>
            <dt>Телефон</dt>
            <dd>
              <a href={`tel:${order.phone}`}>{order.phone}</a>
            </dd>
          </div>
          {accountId ? (
            <div>
              <dt>Кабінет</dt>
              <dd>
                {can(PermissionKeys.Customers.View) ? (
                  <Link to={`/sales/customers/accounts/${encodeURIComponent(accountId)}`}>Кабінет покупця</Link>
                ) : (
                  'Зареєстрований покупець'
                )}
              </dd>
            </div>
          ) : null}
          {order.email ? (
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${order.email}`}>{order.email}</a>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Отримання</dt>
            <dd>
              {deliveryMethodLabel[order.deliveryMethod] ?? order.deliveryMethod}
              {order.settlementName ? `: ${order.settlementName}` : ''}
              {order.warehouseName ? `, ${order.warehouseName}` : ''}
              {order.deliveryAddress ? `, ${order.deliveryAddress}` : ''}
              {order.pickupAddress ? `: ${order.pickupAddress}` : ''}
            </dd>
          </div>
          <div>
            <dt>Оплата</dt>
            <dd>{paymentMethodLabel[order.paymentMethod] ?? order.paymentMethod}</dd>
          </div>
          {order.comment ? (
            <div className="is-wide">
              <dt>Коментар</dt>
              <dd className="order-comment">{order.comment}</dd>
            </div>
          ) : null}
        </dl>
      </OrderCardBody>
    </OrderCard>
  )
}
