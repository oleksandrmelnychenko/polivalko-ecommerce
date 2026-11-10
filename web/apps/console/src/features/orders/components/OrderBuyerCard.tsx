import { ActionIcon, CopyButton, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy, IconMail, IconPhone, IconUserCircle } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { deliveryMethodLabel, paymentMethodLabel } from '@polivalko/shared/lib/labels'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import type { ConsoleOrder } from '../api/orderDetailApi'
import { formatPhone } from '../lib/orderDetail'
import { OrderCard } from './OrderCard'

export function OrderBuyerCard({ order }: { order: ConsoleOrder }) {
  const { can } = usePermissions()
  const accountId = order.customerAccountId
  const deliveryLines = [order.settlementName, order.warehouseName, order.deliveryAddress, order.pickupAddress].filter(Boolean)

  const aside = accountId ? (
    can(PermissionKeys.Customers.View) ? (
      <Link className="order-buyer-account" to={`/sales/customers/accounts/${encodeURIComponent(accountId)}`}>
        <IconUserCircle size={15} stroke={1.8} aria-hidden="true" />
        Кабінет покупця
      </Link>
    ) : (
      <span className="order-buyer-tag">З кабінетом</span>
    )
  ) : (
    <span className="order-buyer-tag">Без кабінету</span>
  )

  return (
    <OrderCard className="order-area-buyer" title="Покупець" aside={aside}>
      <div className="order-buyer">
        <div className="order-buyer-person">
          <p className="order-buyer-name">{order.customerName}</p>
          <ul className="order-buyer-contacts">
            <BuyerContact icon={<IconPhone size={15} stroke={1.8} />} href={`tel:${order.phone}`} copy={order.phone} label="телефон">
              {formatPhone(order.phone)}
            </BuyerContact>
            {order.email ? (
              <BuyerContact icon={<IconMail size={15} stroke={1.8} />} href={`mailto:${order.email}`} copy={order.email} label="email">
                {order.email}
              </BuyerContact>
            ) : null}
          </ul>
        </div>

        <dl className="order-buyer-facts">
          <div>
            <dt>Доставка</dt>
            <dd>
              <strong>{deliveryMethodLabel[order.deliveryMethod] ?? order.deliveryMethod}</strong>
              {deliveryLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </dd>
          </div>
          <div>
            <dt>Оплата</dt>
            <dd>
              <strong>{paymentMethodLabel[order.paymentMethod] ?? order.paymentMethod}</strong>
            </dd>
          </div>
        </dl>

        {order.comment ? (
          <figure className="order-buyer-comment">
            <figcaption>Коментар покупця</figcaption>
            <blockquote>{order.comment}</blockquote>
          </figure>
        ) : null}
      </div>
    </OrderCard>
  )
}

function BuyerContact({ icon, href, copy, label, children }: { icon: ReactNode; href: string; copy: string; label: string; children: ReactNode }) {
  return (
    <li>
      <span className="order-buyer-icon" aria-hidden="true">
        {icon}
      </span>
      <a href={href}>{children}</a>
      <CopyButton value={copy} timeout={1500}>
        {({ copied, copy: doCopy }) => (
          <Tooltip label={copied ? 'Скопійовано' : `Скопіювати ${label}`} withArrow position="left">
            <ActionIcon
              className="order-buyer-copy"
              variant="subtle"
              color={copied ? 'brand' : 'gray'}
              size="sm"
              aria-label={`Скопіювати ${label}`}
              onClick={doCopy}
            >
              {copied ? <IconCheck size={14} stroke={2} /> : <IconCopy size={14} stroke={1.8} />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </li>
  )
}
