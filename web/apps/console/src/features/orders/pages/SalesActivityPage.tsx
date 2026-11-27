import { Button, Text, TextInput } from '@mantine/core'
import {
  IconActivity,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconFlame,
  IconHeart,
  IconHeartOff,
  IconPlayerPause,
  IconPlayerPlay,
  IconScale,
  IconSearch,
  IconShoppingCart,
  IconShoppingCartOff,
  IconShoppingCartPlus,
  IconUsers,
} from '@tabler/icons-react'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { SalesRegister } from '@/shared/sales/SalesRegister'
import { getShopActivity, type ShopActivityItem } from '../api/activityApi'
import { OpenCartsList } from '../components/OpenCarts'
import { useActivityStream } from '../lib/useActivityStream'
import '@/shared/sales/sales-list.css'
import './orders.css'
import './activity.css'

type ActivityTab = 'feed' | 'carts' | 'top'
type KindFilter = '' | 'cart' | 'compare' | 'favorite'

const countFormat = new Intl.NumberFormat('uk-UA')

function formatRelative(iso: string, nowMs: number): string {
  const sec = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 1000))
  if (sec < 15) return 'щойно'
  if (sec < 60) return `${sec} сек тому`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} хв тому`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours} год тому`
  const days = Math.floor(hours / 24)
  return `${days} дн тому`
}

function ActionBadge({ item }: { item: ShopActivityItem }) {
  switch (item.kind) {
    case 'cart_add':
      return (
        <span className="activity-badge activity-badge--cart-add">
          <IconShoppingCartPlus size={14} stroke={2} />
          У кошик{item.quantity > 1 ? ` +${item.quantity}` : ''}
        </span>
      )
    case 'cart_remove':
      return (
        <span className="activity-badge activity-badge--muted">
          <IconShoppingCartOff size={14} stroke={1.8} />
          З кошика{item.quantity > 1 ? ` −${item.quantity}` : ''}
        </span>
      )
    case 'compare_add':
      return (
        <span className="activity-badge activity-badge--compare">
          <IconScale size={14} stroke={2} />
          Порівняння
        </span>
      )
    case 'compare_remove':
      return (
        <span className="activity-badge activity-badge--muted">
          <IconScale size={14} stroke={1.8} />
          Прибрав із порівняння
        </span>
      )
    case 'favorite_add':
      return (
        <span className="activity-badge activity-badge--favorite">
          <IconHeart size={14} stroke={2} />
          Поставив лайк
        </span>
      )
    case 'favorite_remove':
      return (
        <span className="activity-badge activity-badge--muted">
          <IconHeartOff size={14} stroke={1.8} />
          Зняв лайк
        </span>
      )
    default:
      return <span className="activity-badge activity-badge--muted">{item.kind}</span>
  }
}

export function SalesActivityPage() {
  const [tab, setTab] = useState<ActivityTab>('feed')
  const [kind, setKind] = useState<KindFilter>('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(30)
  const [paused, setPaused] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = searchInput.trim()
      if (trimmed !== search) {
        setSearch(trimmed)
        setPage(1)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchInput, search])

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const query = useMemo(
    () => ({
      kind: kind || undefined,
      search: search || undefined,
      page,
      pageSize,
    }),
    [kind, search, page, pageSize],
  )

  const activity = useApiQuery(
    `sales-activity:${JSON.stringify(query)}`,
    () => getShopActivity(query),
    { keepPrevious: true },
  )

  const streamMode = useActivityStream(paused, () => {
    if (!activity.isFetching) {
      setNowMs(Date.now())
      activity.reload()
    }
  })

  // Track newly arrived event IDs so freshly pushed rows pulse subtly once.
  const seenIdsRef = useRef<Set<string> | null>(null)
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(() => new Set())
  const items = activity.data?.events.items

  useEffect(() => {
    if (!items) return
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(items.map((item) => item.id))
      return
    }
    const newlyArrived = items.filter((item) => !seenIdsRef.current!.has(item.id)).map((item) => item.id)
    for (const item of items) seenIdsRef.current.add(item.id)
    if (newlyArrived.length === 0) return
    const next = new Set(newlyArrived)
    const frame = window.requestAnimationFrame(() => setFreshIds(next))
    const clear = window.setTimeout(() => setFreshIds(new Set()), 3500)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(clear)
    }
  }, [items])

  const summary = activity.data?.summary
  const topProducts = activity.data?.topProducts ?? []
  const eventsPage = activity.data?.events

  function selectKind(next: KindFilter) {
    setKind(next)
    setPage(1)
    setTab('feed')
  }

  return (
    <ListPage className="sales-list-page sales-activity-page">
      <PageHeader title="На сайті зараз" />

      <div className="sales-status-picker">
        <div className="sales-status-cards">
          <button
            type="button"
            className="sales-status-card"
            aria-pressed={tab === 'feed' && kind === 'cart'}
            onClick={() => selectKind(kind === 'cart' ? '' : 'cart')}
          >
            <MetricLabel icon={IconShoppingCart}>У кошик · 24 год</MetricLabel>
            <strong>{summary ? countFormat.format(summary.cartAdds24h) : '—'}</strong>
            <span className="activity-kpi-sub">
              {summary ? `Відкритих зараз: ${summary.openCartsCount} (${formatMoney(summary.openCartsSubtotal)})` : '\u00a0'}
            </span>
          </button>

          <button
            type="button"
            className="sales-status-card"
            aria-pressed={tab === 'feed' && kind === 'compare'}
            onClick={() => selectKind(kind === 'compare' ? '' : 'compare')}
          >
            <MetricLabel icon={IconScale}>Порівняння · 24 год</MetricLabel>
            <strong>{summary ? countFormat.format(summary.compareAdds24h) : '—'}</strong>
            <span className="activity-kpi-sub">Додано товарів до порівняння</span>
          </button>

          <button
            type="button"
            className="sales-status-card"
            aria-pressed={tab === 'feed' && kind === 'favorite'}
            onClick={() => selectKind(kind === 'favorite' ? '' : 'favorite')}
          >
            <MetricLabel icon={IconHeart}>Лайки · 24 год</MetricLabel>
            <strong>{summary ? countFormat.format(summary.favoriteAdds24h) : '—'}</strong>
            <span className="activity-kpi-sub">Додано до обраного</span>
          </button>

          <button
            type="button"
            className="sales-status-card"
            aria-pressed={tab === 'feed' && kind === ''}
            onClick={() => selectKind('')}
          >
            <MetricLabel icon={IconUsers}>Активні · 15 хв</MetricLabel>
            <strong>{summary ? countFormat.format(summary.activeVisitors15m) : '—'}</strong>
            <span className="activity-kpi-sub">Унікальних покупців і гостей</span>
          </button>
        </div>
      </div>

      <SalesRegister
        title="Активність на вітрині"
        icon={IconActivity}
        actions={
          <>
            <span className={`activity-live-pill activity-live-pill--${streamMode}`} role="status">
              <span className="activity-live-dot" aria-hidden="true" />
              {streamMode === 'live' ? 'Наживо' : streamMode === 'polling' ? 'Оновлення 5 с' : 'На паузі'}
            </span>
            <Button
              size="xs"
              variant="default"
              radius="xl"
              leftSection={paused ? <IconPlayerPlay size={14} /> : <IconPlayerPause size={14} />}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? 'Відновити' : 'Пауза'}
            </Button>
            <div className="orders-status-options" role="tablist" aria-label="Подання активності">
              <button type="button" role="tab" aria-selected={tab === 'feed'} onClick={() => setTab('feed')}>
                Стрічка
              </button>
              <button type="button" role="tab" aria-selected={tab === 'carts'} onClick={() => setTab('carts')}>
                Відкриті кошики {summary ? <span>{summary.openCartsCount}</span> : null}
              </button>
              <button type="button" role="tab" aria-selected={tab === 'top'} onClick={() => setTab('top')}>
                <IconFlame size={14} /> Топ (7 дн.)
              </button>
            </div>
          </>
        }
      >
        {tab === 'feed' && (
          <>
            <div className="app-filter-bar activity-toolbar">
              <div className="orders-status-options" role="group" aria-label="Фільтр за дією">
                {(
                  [
                    ['', 'Усі'],
                    ['cart', 'Кошик'],
                    ['compare', 'Порівняння'],
                    ['favorite', 'Лайки'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value || 'all'}
                    type="button"
                    aria-pressed={kind === value}
                    onClick={() => selectKind(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <TextInput
                size="xs"
                radius="xl"
                className="activity-search"
                leftSection={<IconSearch size={14} />}
                placeholder="Товар, артикул, покупець або #код гостя"
                value={searchInput}
                onChange={(e) => setSearchInput(e.currentTarget.value)}
              />

              <div className="activity-toolbar-end">
                {eventsPage ? <span className="app-filter-summary">Подій: {countFormat.format(eventsPage.totalItems)}</span> : null}
                <Paginator
                  page={page}
                  pageSize={pageSize}
                  totalPages={eventsPage?.totalPages}
                  isLoading={activity.isFetching}
                  onPageChange={setPage}
                  onPageSizeChange={(next) => {
                    setPageSize(next)
                    setPage(1)
                  }}
                  onRefresh={() => {
                    setNowMs(Date.now())
                    activity.reload()
                  }}
                />
              </div>
            </div>

            <ListPageBody>
              {activity.status !== 'ready' && !activity.data ? (
                <PageState kind={activity.status} onRetry={activity.reload} />
              ) : !eventsPage?.items.length ? (
                <div className="activity-empty">
                  <Text fw={500}>Подій поки немає</Text>
                  <Text size="sm" c="dimmed">
                    Щойно хтось додасть товар у кошик, натисне лайк або відкриє порівняння на сайті — подія з’явиться тут автоматично.
                  </Text>
                </div>
              ) : (
                <div className="activity-table-wrap">
                  <table className="activity-table">
                    <thead>
                      <tr>
                        <th>Коли</th>
                        <th>Дія</th>
                        <th>Товар</th>
                        <th>Хто</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventsPage.items.map((item) => (
                        <tr key={item.id} className={freshIds.has(item.id) ? 'activity-row activity-row--fresh' : 'activity-row'}>
                          <td className="activity-cell-time">
                            <span className="activity-rel">{formatRelative(item.occurredAt, nowMs)}</span>
                            <span className="activity-abs">{formatDateTime(item.occurredAt)}</span>
                          </td>
                          <td className="activity-cell-action">
                            <ActionBadge item={item} />
                          </td>
                          <td className="activity-cell-product">
                            <div className="activity-product">
                              <span className="activity-thumb">
                                {item.productImageUrl ? <img src={item.productImageUrl} alt="" loading="lazy" /> : null}
                              </span>
                              <div className="activity-product-info">
                                <Link className="activity-product-name" to={`/catalog/products/${item.productId}`}>
                                  {item.productName}
                                </Link>
                                <span className="activity-product-meta">
                                  {item.productSku ? `Арт. ${item.productSku} · ` : ''}
                                  {formatMoney(item.productPrice)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="activity-cell-who">
                            <div className="activity-who">
                              {item.customerId ? (
                                <>
                                  <Link className="activity-customer-link" to={`/sales/customers/accounts/${item.customerId}`}>
                                    {item.customerName || 'Зареєстрований покупець'}
                                  </Link>
                                  <span className="activity-who-meta">
                                    {[item.customerPhone, item.customerEmail].filter(Boolean).join(' · ')}
                                  </span>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="activity-guest-btn"
                                  title="Показати всі дії цього гостя"
                                  onClick={() => setSearchInput(item.visitorTag)}
                                >
                                  Гість · #{item.visitorTag || '—'}
                                </button>
                              )}
                              <span className="activity-device" title={item.device === 'mobile' ? 'Мобільний пристрій' : 'Комп’ютер'}>
                                {item.device === 'mobile' ? <IconDeviceMobile size={13} /> : <IconDeviceDesktop size={13} />}
                                {item.device === 'mobile' ? 'Телефон' : 'ПК'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ListPageBody>
          </>
        )}

        {tab === 'carts' && (
          <div className="activity-inline-carts">
            <OpenCartsList />
          </div>
        )}

        {tab === 'top' && (
          <ListPageBody>
            {topProducts.length === 0 ? (
              <div className="activity-empty">
                <Text fw={500}>За останні 7 днів даних ще немає</Text>
                <Text size="sm" c="dimmed">Тут з’являться товари, які покупці найчастіше додають у кошик, порівнюють і лайкають.</Text>
              </div>
            ) : (
              <div className="activity-table-wrap">
                <table className="activity-table">
                  <thead>
                    <tr>
                      <th>Товар</th>
                      <th className="activity-num-col">У кошик</th>
                      <th className="activity-num-col">Порівняння</th>
                      <th className="activity-num-col">Лайки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((product) => (
                      <tr key={product.productId} className="activity-row">
                        <td className="activity-cell-product">
                          <div className="activity-product">
                            <span className="activity-thumb">
                              {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : null}
                            </span>
                            <div className="activity-product-info">
                              <Link className="activity-product-name" to={`/catalog/products/${product.productId}`}>
                                {product.name}
                              </Link>
                              <span className="activity-product-meta">
                                {product.sku ? `Арт. ${product.sku} · ` : ''}
                                {formatMoney(product.price)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="activity-num-col">
                          <span className="activity-badge activity-badge--cart-add">{product.cartAdds}</span>
                        </td>
                        <td className="activity-num-col">
                          <span className="activity-badge activity-badge--compare">{product.compareAdds}</span>
                        </td>
                        <td className="activity-num-col">
                          <span className="activity-badge activity-badge--favorite">{product.favoriteAdds}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ListPageBody>
        )}
      </SalesRegister>
    </ListPage>
  )
}
