import { Button, Skeleton } from '@mantine/core'
import { IconLock, IconLockOpen, IconMailForward } from '@tabler/icons-react'
import { useState } from 'react'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { deliveryMethodLabel } from '@polivalko/shared/lib/labels'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { OrdersList } from '@/shared/sales/SalesLists'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { SplitAvatar } from '@/shared/ui/split/SplitAvatar'
import { getAccount, lockAccount, sendPasswordReset, type AccountAddress } from '../api/accountsApi'
import { AccountChips } from './AccountChips'

type PendingAction = 'lock' | 'unlock' | 'reset' | null

type AccountDetailPaneProps = {
  id: string | null
  canManage: boolean
  canViewOrders: boolean
  onChanged: () => void
}

export function AccountDetailPane({ id, canManage, canViewOrders, onChanged }: AccountDetailPaneProps) {
  const account = useApiQuery(`account:${id ?? ''}`, () => getAccount(id ?? ''), { enabled: Boolean(id) })
  const [pending, setPending] = useState<PendingAction>(null)
  const [busy, setBusy] = useState(false)

  if (!id) return <section className="app-split-detail app-split-detail-empty">Оберіть кабінет зліва.</section>

  const data = account.isFetching && account.data?.id !== id ? undefined : account.data

  if (!data) {
    if (account.isFetching) {
      return (
        <section className="app-split-detail" aria-busy="true">
          <Skeleton height={190} radius={14} />
        </section>
      )
    }
    return (
      <section className="app-split-detail app-split-detail-empty">
        <p className="app-split-blank">{problemMessage(account.problem, 'Не вдалося завантажити кабінет.')}</p>
        <Button size="xs" variant="default" onClick={account.reload}>
          Спробувати ще раз
        </Button>
      </section>
    )
  }

  const name = data.name || data.email

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
          onChanged()
          notifySuccess(locked ? 'Кабінет заблоковано.' : 'Кабінет розблоковано.')
        } else {
          notifyError(problemMessage(result.error, locked ? 'Не вдалося заблокувати кабінет.' : 'Не вдалося розблокувати кабінет.'))
        }
      }
      setPending(null)
    } catch {
      notifyError(NETWORK_ERROR)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section key={data.id} className="app-split-detail" aria-labelledby="account-detail-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <SplitAvatar name={name} size="lg" muted={data.blocked || data.lockedOut} />
            <div className="app-split-hero-main">
              <p className="app-split-hero-kicker">Кабінет покупця</p>
              <h2 id="account-detail-title">{data.name || 'Без імені'}</h2>
              <p className="app-split-hero-aliases">
                <a href={`mailto:${data.email}`}>{data.email}</a>
                <span className="app-split-dot">{data.phone ? <a href={`tel:${data.phone}`}>{data.phone}</a> : 'телефон не вказано'}</span>
              </p>
              <div className="customers-hero-chips">
                <AccountChips emailConfirmed={data.emailConfirmed} lockedOut={data.lockedOut} blocked={data.blocked} />
              </div>
            </div>
          </div>
        </div>

        <dl className="app-split-stats">
          <div>
            <dt>Замовлень</dt>
            <dd>{data.ordersCount}</dd>
          </div>
          <div>
            <dt>В обраному</dt>
            <dd>{data.favoritesCount}</dd>
          </div>
          <div>
            <dt>Адрес</dt>
            <dd>{data.addresses.length}</dd>
          </div>
        </dl>

        {canManage ? (
          <div className="app-split-bar">
            <span className="app-split-bar-label">Зареєстровано {formatDateTime(data.createdAt)}</span>
            <span className="app-split-bar-end customers-actions">
              <Button size="xs" variant="default" leftSection={<IconMailForward size={15} stroke={1.7} />} onClick={() => setPending('reset')}>
                Надіслати лист для скидання пароля
              </Button>
              {data.blocked ? (
                <Button size="xs" variant="default" leftSection={<IconLockOpen size={15} stroke={1.7} />} onClick={() => setPending('unlock')}>
                  Розблокувати кабінет
                </Button>
              ) : (
                <Button size="xs" variant="light" color="red" leftSection={<IconLock size={15} stroke={1.7} />} onClick={() => setPending('lock')}>
                  Заблокувати кабінет
                </Button>
              )}
            </span>
          </div>
        ) : (
          <div className="app-split-bar">
            <span className="app-split-bar-label">Зареєстровано {formatDateTime(data.createdAt)}</span>
          </div>
        )}
      </header>

      <section className="app-split-card" aria-labelledby="account-orders-title">
        <header className="app-split-card-head">
          <h3 id="account-orders-title">Замовлення через кабінет</h3>
        </header>
        {data.orders.length ? (
          <OrdersList orders={data.orders} canOpen={canViewOrders} label="Замовлення через кабінет" />
        ) : (
          <p className="app-split-blank">Через кабінет ще не оформлено жодного замовлення.</p>
        )}
      </section>

      <section className="app-split-card" aria-labelledby="account-addresses-title">
        <header className="app-split-card-head">
          <h3 id="account-addresses-title">Збережені адреси</h3>
        </header>
        {data.addresses.length ? (
          <ul className="customers-addresses">
            {data.addresses.map((address) => (
              <li key={address.id}>
                <span className="customers-address-title">
                  {address.label || deliveryMethodLabel[address.method] || address.method}
                  {address.isDefault ? <span className="customers-address-default">основна</span> : null}
                </span>
                <span className="customers-address-text">{addressText(address)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="app-split-blank">Покупець ще не зберіг жодної адреси.</p>
        )}
      </section>

      <ConfirmDialog
        opened={pending !== null}
        title={pending === 'reset' ? 'Скидання пароля' : pending === 'lock' ? 'Заблокувати кабінет' : 'Розблокувати кабінет'}
        message={
          pending === 'reset'
            ? `Сайт надішле на ${data.email} лист із посиланням для нового пароля. Поточний пароль діятиме, доки покупець його не змінить.`
            : pending === 'lock'
              ? `${name} не зможе увійти в кабінет на сайті, доки його не розблокують.`
              : `${name} знову зможе входити в кабінет на сайті.`
        }
        confirmLabel={pending === 'reset' ? 'Надіслати лист' : pending === 'lock' ? 'Заблокувати кабінет' : 'Розблокувати кабінет'}
        danger={pending === 'lock'}
        busy={busy}
        onConfirm={() => void confirm()}
        onClose={() => setPending(null)}
      />
    </section>
  )
}

function addressText(address: AccountAddress): string {
  const street = address.address ? [address.address.street, address.address.house, address.address.apartment ? `кв. ${address.address.apartment}` : ''].filter(Boolean).join(', ') : ''
  return [address.settlementName, address.warehouseName, street].filter(Boolean).join(', ')
}
