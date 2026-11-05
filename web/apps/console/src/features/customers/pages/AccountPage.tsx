import { Button, Table } from '@mantine/core'
import { IconChevronRight, IconLock, IconLockOpen, IconMailForward } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { OrderStatus } from '@polivalko/shared/api/types'
import { formatDateTime, formatMoney, plural } from '@polivalko/shared/lib/format'
import { deliveryMethodLabel } from '@polivalko/shared/lib/labels'
import { usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { OrderStatusChip } from '@/shared/ui/StatusChip'
import { getAccount, lockAccount, sendPasswordReset, type AccountAddress, type AccountDetails } from '../api/accountsApi'
import { AccountChips } from '../components/AccountChips'
import { ACCOUNTS_LIST_PATH } from '../lib/accountsState'
import { initials } from '../lib/initials'
import './account.css'

type PendingAction = 'lock' | 'unlock' | 'reset' | null

const countFormat = new Intl.NumberFormat('uk-UA')

export function AccountPage() {
  const { id = '' } = useParams()
  return <AccountDetail key={id} id={id} />
}

function AccountDetail({ id }: { id: string }) {
  const account = useApiQuery(`account:${id}`, () => getAccount(id))
  const { can } = usePermissions()
  const canManage = can(PermissionKeys.Customers.ManageAccounts)
  const canViewOrders = can(PermissionKeys.Orders.View)
  const [pending, setPending] = useState<PendingAction>(null)
  const [busy, setBusy] = useState(false)
  const data = account.data
  const name = data?.name || data?.email || 'Покупець'

  async function confirm() {
    if (!data || !pending) return
    setBusy(true)
    try {
      if (pending === 'reset') {
        const result = await withCsrf((headers) => sendPasswordReset(headers, data.id))
        if (result.response.ok) notifySuccess(`Лист для скидання пароля надіслано на ${data.email}.`)
        else notifyError(problemMessage(result.error, 'Не вдалося надіслати лист.'))
      } else {
        const locked = pending === 'lock'
        const result = await withCsrf((headers) => lockAccount(headers, data.id, locked))
        if (result.response.ok) {
          account.setData({ ...data, ...result.data, blocked: locked })
          account.reload()
          notifySuccess(locked ? 'Кабінет заблоковано.' : 'Кабінет розблоковано.')
        } else {
          notifyError(problemMessage(result.error, locked ? 'Не вдалося заблокувати кабінет.' : 'Не вдалося розблокувати кабінет.'))
        }
      }
      setPending(null)
    } catch {
      notifyError("Немає зв'язку з сервером. Спробуйте ще раз.")
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <PageHeader
      title={data ? `Кабінет: ${name}` : 'Кабінет покупця'}
      heading={
        <nav className="account-crumbs" aria-label="Хлібні крихти">
          <Link to={ACCOUNTS_LIST_PATH}>Кабінети покупців</Link>
          <IconChevronRight size={14} stroke={1.8} aria-hidden="true" />
          <span aria-current="page">{data ? name : '…'}</span>
        </nav>
      }
      actions={
        data && canManage ? (
          <>
            <Button variant="default" leftSection={<IconMailForward size={16} stroke={1.8} />} onClick={() => setPending('reset')}>
              Надіслати лист для скидання пароля
            </Button>
            {data.blocked ? (
              <Button variant="default" leftSection={<IconLockOpen size={16} stroke={1.8} />} onClick={() => setPending('unlock')}>
                Розблокувати кабінет
              </Button>
            ) : (
              <Button variant="default" leftSection={<IconLock size={16} stroke={1.8} />} onClick={() => setPending('lock')}>
                Заблокувати кабінет
              </Button>
            )}
          </>
        ) : null
      }
    />
  )

  if (!data) {
    return (
      <>
        {header}
        {account.status === 'loading' ? (
          <PageState kind="loading" />
        ) : (
          <PageState
            kind={account.status === 'forbidden' ? 'forbidden' : 'error'}
            title={account.problem?.title ?? (account.status === 'forbidden' ? undefined : 'Не вдалося завантажити кабінет')}
            description={account.problem?.detail ?? 'Перевірте, що API працює, і спробуйте ще раз.'}
            onRetry={account.status === 'forbidden' ? undefined : account.reload}
          />
        )}
      </>
    )
  }

  return (
    <div className="account-page">
      {header}

      <section className="account-hero" aria-label="Покупець">
        <div className="account-hero-main">
          <span className="account-avatar" aria-hidden="true">
            {initials(name)}
          </span>
          <div className="account-hero-text">
            <span className="account-eyebrow">Кабінет покупця</span>
            <h1 className="account-name">{name}</h1>
            <AccountChips emailConfirmed={data.emailConfirmed} lockedOut={data.lockedOut} blocked={data.blocked} />
          </div>
        </div>
        <dl className="account-metrics">
          <div className="account-metric">
            <dt>Замовлень</dt>
            <dd>{countFormat.format(data.ordersCount)}</dd>
          </div>
          <div className="account-metric">
            <dt>В обраному</dt>
            <dd>{countFormat.format(data.favoritesCount)}</dd>
          </div>
          <div className="account-metric">
            <dt>Адрес</dt>
            <dd>{countFormat.format(data.addresses.length)}</dd>
          </div>
        </dl>
      </section>

      <div className="account-layout">
        <AccountOrders account={data} canViewOrders={canViewOrders} />
        <div className="account-col">
          <section className="account-card" aria-labelledby="account-contacts">
            <header className="account-card-head">
              <h2 id="account-contacts" className="account-card-title">
                Контакти
              </h2>
            </header>
            <dl className="account-facts">
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${data.email}`}>{data.email}</a>
                </dd>
              </div>
              <div>
                <dt>Телефон</dt>
                <dd>{data.phone ? <a href={`tel:${data.phone}`}>{data.phone}</a> : 'не вказано'}</dd>
              </div>
              <div>
                <dt>Зареєстровано</dt>
                <dd>{formatDateTime(data.createdAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="account-card" aria-labelledby="account-addresses">
            <header className="account-card-head">
              <h2 id="account-addresses" className="account-card-title">
                Збережені адреси
              </h2>
            </header>
            {data.addresses.length ? (
              <ul className="account-addresses">
                {data.addresses.map((address) => (
                  <li key={address.id}>
                    <span className="account-address-title">
                      {address.label || deliveryMethodLabel[address.method] || address.method}
                      {address.isDefault ? <span className="account-address-default">основна</span> : null}
                    </span>
                    <span className="account-address-text">{addressText(address)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="account-card-note">Покупець ще не зберіг жодної адреси.</p>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        opened={pending !== null}
        title={pending === 'reset' ? 'Скидання пароля' : pending === 'lock' ? 'Заблокувати кабінет' : 'Розблокувати кабінет'}
        message={
          pending === 'reset'
            ? `На ${data.email} буде надіслано лист із посиланням для встановлення нового пароля. Поточний пароль діятиме, доки покупець його не змінить.`
            : pending === 'lock'
              ? `${name} не зможе увійти в кабінет на сайті, доки його не розблокують.`
              : `${name} знову зможе входити в кабінет на сайті.`
        }
        confirmLabel={pending === 'reset' ? 'Надіслати лист' : pending === 'lock' ? 'Заблокувати' : 'Розблокувати'}
        danger={pending === 'lock'}
        busy={busy}
        onConfirm={() => void confirm()}
        onClose={() => setPending(null)}
      />
    </div>
  )
}

function AccountOrders({ account, canViewOrders }: { account: AccountDetails; canViewOrders: boolean }) {
  return (
    <section className="account-card" aria-labelledby="account-orders">
      <header className="account-card-head">
        <h2 id="account-orders" className="account-card-title">
          Замовлення
        </h2>
        <span className="account-card-meta">
          {account.orders.length} {plural(account.orders.length, 'замовлення', 'замовлення', 'замовлень')}
        </span>
      </header>
      {account.orders.length ? (
        <Table.ScrollContainer minWidth={520} type="native">
          <Table className="account-table" verticalSpacing={8} horizontalSpacing={14}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Номер</Table.Th>
                <Table.Th scope="col">Оформлено</Table.Th>
                <Table.Th scope="col">Статус</Table.Th>
                <Table.Th scope="col" className="is-num">
                  Сума
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {account.orders.map((order) => (
                <Table.Tr key={order.number}>
                  <Table.Td className="is-code">
                    {canViewOrders ? <Link to={`/sales/orders/${encodeURIComponent(order.number)}`}>{order.number}</Link> : order.number}
                  </Table.Td>
                  <Table.Td className="is-nowrap">{formatDateTime(order.createdAt)}</Table.Td>
                  <Table.Td>
                    <OrderStatusChip status={order.status as OrderStatus} />
                  </Table.Td>
                  <Table.Td className="is-num is-strong">{formatMoney(order.total)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : (
        <p className="account-card-note">Через кабінет ще не оформлено жодного замовлення.</p>
      )}
    </section>
  )
}

function addressText(address: AccountAddress): string {
  const street = address.address ? [address.address.street, address.address.house, address.address.apartment ? `кв. ${address.address.apartment}` : ''].filter(Boolean).join(', ') : ''
  return [address.settlementName, address.warehouseName, street].filter(Boolean).join(', ')
}
