import { Button, Skeleton } from '@mantine/core'
import { IconArrowRight, IconId, IconReceiptRefund, IconShoppingBag } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { formatDateTime, formatPrice, plural } from '@polivalko/shared/lib/format'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { shortWhen } from '@/shared/lib/when'
import { findAccounts, findOrders, findRefunds, ordersSearchHref, type AccountListItem } from '@/shared/sales/salesLookups'
import { OrdersList, RefundsList } from '@/shared/sales/SalesLists'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { Money } from '@/shared/ui/Money'
import { SplitAvatar } from '@/shared/ui/split/SplitAvatar'
import type { Customer } from '../api/customersApi'
import { AccountChips } from './AccountChips'

const ORDERS_SHOWN = 5

type CustomerDetailPaneProps = {
  customer: Customer
  canViewOrders: boolean
  onOpenAccount: (account: AccountListItem) => void
}

function digits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

export function CustomerDetailPane({ customer, canViewOrders, onOpenAccount }: CustomerDetailPaneProps) {
  const phone = customer.phone
  const email = customer.email ?? ''
  const orders = useApiQuery(`customer-orders:${phone}`, () => findOrders(phone, ORDERS_SHOWN), { enabled: canViewOrders && Boolean(phone) })
  const refunds = useApiQuery(`customer-refunds:${phone}`, () => findRefunds(phone, 20), { enabled: canViewOrders && Boolean(phone) })
  const byPhone = useApiQuery(`customer-account-phone:${phone}`, () => findAccounts(phone), { enabled: Boolean(phone) })
  const phoneMatch = (byPhone.isFetching ? [] : (byPhone.data?.items ?? [])).find((account) => digits(account.phone) === digits(phone)) ?? null
  const byEmail = useApiQuery(`customer-account-email:${email}`, () => findAccounts(email), { enabled: Boolean(email) && !byPhone.isFetching && (!phone || byPhone.status === 'ready') && !phoneMatch })

  const account = phoneMatch ?? (byEmail.isFetching || !email ? [] : (byEmail.data?.items ?? [])).find((item) => item.email.toLowerCase() === email.toLowerCase()) ?? null
  const accountLoading = byPhone.isFetching || byEmail.isFetching
  const average = customer.orders > 0 ? Number(customer.totalSpent.value) / customer.orders : 0
  const refundItems = refunds.isFetching ? [] : (refunds.data?.items ?? [])
  const orderItems = orders.isFetching ? [] : (orders.data?.items ?? [])

  return (
    <section key={customer.phone} className="app-split-detail" aria-labelledby="customer-detail-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <SplitAvatar name={customer.name} size="lg" />
            <div className="app-split-hero-main">
              <p className="app-split-hero-kicker">{customer.orders > 1 ? 'Постійний покупець' : 'Покупець'}</p>
              <h2 id="customer-detail-title">{customer.name}</h2>
              <p className="app-split-hero-aliases">
                <a href={`tel:${customer.phone}`}>{customer.phone}</a>
                {customer.email ? (
                  <span className="app-split-dot">
                    <a href={`mailto:${customer.email}`}>{customer.email}</a>
                  </span>
                ) : (
                  <span className="app-split-dot">без email</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <dl className="app-split-stats">
          <div>
            <dt>Замовлень</dt>
            <dd>{customer.orders}</dd>
          </div>
          <div>
            <dt>Сума покупок</dt>
            <dd>
              <Money value={customer.totalSpent} />
            </dd>
          </div>
          <div>
            <dt>Середній чек</dt>
            <dd>{formatPrice(Math.round(average * 100) / 100)}</dd>
          </div>
        </dl>
      </header>

      <section className="app-split-card" aria-labelledby="customer-orders-title">
        <header className="app-split-card-head">
          <h3 id="customer-orders-title"><MetricLabel icon={IconShoppingBag}>Замовлення</MetricLabel></h3>
          {canViewOrders ? (
            <Button component={Link} to={ordersSearchHref(customer.phone)} radius="xl" variant="default" size="xs" rightSection={<IconArrowRight size={14} />}>
              Усі замовлення
            </Button>
          ) : null}
        </header>
        {!canViewOrders ? (
          <dl className="app-split-fields">
            <div>
              <dt>Перше</dt>
              <dd>{formatDateTime(customer.firstOrderAt)}</dd>
            </div>
            <div>
              <dt>Останнє</dt>
              <dd>
                <span className="app-split-mono">{customer.lastOrderNumber}</span>
                <span className="app-split-dot">{formatDateTime(customer.lastOrderAt)}</span>
              </dd>
            </div>
          </dl>
        ) : orders.isFetching ? (
          <Skeleton height={120} radius={8} />
        ) : orders.status !== 'ready' ? (
          <p>Не вдалося завантажити замовлення. <Button size="xs" variant="subtle" onClick={orders.reload}>Повторити</Button></p>
        ) : orderItems.length ? (
          <>
            <OrdersList orders={orderItems} canOpen label="Останні замовлення покупця" />
            <p className="app-split-blank">Перше замовлення {shortWhen(customer.firstOrderAt)}.</p>
          </>
        ) : (
          <p className="app-split-blank">Замовлень з цього номера не знайдено.</p>
        )}
      </section>

      <section className="app-split-card" aria-labelledby="customer-account-title">
        <header className="app-split-card-head">
          <h3 id="customer-account-title"><MetricLabel icon={IconId}>Кабінет на сайті</MetricLabel></h3>
          {account ? (
            <Button radius="xl" size="xs" variant="default" rightSection={<IconArrowRight size={14} />} onClick={() => onOpenAccount(account)}>
              Відкрити кабінет
            </Button>
          ) : null}
        </header>
        {accountLoading ? (
          <Skeleton height={60} radius={8} />
        ) : byPhone.status === 'error' || byPhone.status === 'forbidden' || (!phoneMatch && email && byEmail.status !== 'ready') ? (
          <p>Не вдалося завантажити кабінет. <Button size="xs" variant="subtle" onClick={byPhone.status === 'ready' ? byEmail.reload : byPhone.reload}>Повторити</Button></p>
        ) : account ? (
          <dl className="app-split-fields">
            <div>
              <dt>Обліковий запис</dt>
              <dd>
                {account.name || 'Без імені'}
                <span className="app-split-dot">{account.email}</span>
              </dd>
            </div>
            <div>
              <dt>Стан</dt>
              <dd>
                <AccountChips emailConfirmed={account.emailConfirmed} lockedOut={account.lockedOut} />
              </dd>
            </div>
            <div>
              <dt>Зареєстровано</dt>
              <dd>
                {formatDateTime(account.createdAt)}
                <span className="app-split-dot">
                  {account.ordersCount} {plural(account.ordersCount, 'замовлення', 'замовлення', 'замовлень')} через кабінет
                </span>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="app-split-blank">Кабінету з цим телефоном{customer.email ? ' чи поштою' : ''} на сайті не знайдено.</p>
        )}
      </section>

      {canViewOrders && (refundItems.length > 0 || refunds.status === 'error' || refunds.status === 'forbidden') ? (
        <section className="app-split-card" aria-labelledby="customer-refunds-title">
          <header className="app-split-card-head">
            <h3 id="customer-refunds-title"><MetricLabel icon={IconReceiptRefund}>Повернення</MetricLabel></h3>
            {refunds.status === 'ready' && refunds.data && <span>{refunds.data.totalItems} {plural(refunds.data.totalItems, 'повернення', 'повернення', 'повернень')}</span>}
          </header>
          {refunds.status === 'ready' ? <RefundsList refunds={refundItems} canOpen label="Повернення покупця" /> : <p>Не вдалося завантажити повернення. <Button variant="subtle" size="xs" onClick={refunds.reload}>Повторити</Button></p>}
        </section>
      ) : null}
    </section>
  )
}
