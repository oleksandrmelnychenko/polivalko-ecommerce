import { Accordion, Group, Stack, Text } from '@mantine/core'
import { IconShoppingCart } from '@tabler/icons-react'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { PageState } from '@/shared/ui/PageState'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { getOpenCarts } from '../api/activityApi'
import { useSalesRefresh } from '../lib/useSalesRefresh'

export function OpenCartsList({ onNavigate }: { onNavigate?: () => void }) {
  const [page, setPage] = useState(1)
  const carts = useApiQuery('open-carts:' + page, () => getOpenCarts(page), { keepPrevious: true })
  useSalesRefresh(() => { if (!carts.isFetching) carts.reload() })
  const data = carts.data

  return (
    <Stack gap="sm">
      <Group justify="space-between" className="orders-carts-toolbar">
        <Text size="sm">{data ? `Кошиків: ${data.totalItems}` : 'Завантаження…'}</Text>
        <Paginator page={page} pageSize={20} totalPages={data?.totalPages} isLoading={carts.isFetching}
          onPageChange={setPage} onRefresh={carts.reload} />
      </Group>
      {carts.status !== 'ready' ? <PageState kind={carts.status} onRetry={carts.reload} /> :
        !data?.items.length ? <Text className="orders-carts-empty" size="sm">{page === 1 ? 'Відкритих кошиків поки немає.' : 'На цій сторінці вже немає кошиків.'}</Text> :
        <Accordion variant="separated">
          {data.items.map(cart => {
            const ownerTitle = cart.isGuest
              ? `Гість · #${cart.visitorTag || cart.id.slice(-6).toUpperCase()}`
              : (cart.customerName || 'Зареєстрований покупець')
            const contact = [cart.customerPhone, cart.customerEmail].filter(Boolean).join(' · ')
            return (
              <Accordion.Item key={cart.id} value={cart.id}>
                <Accordion.Control>
                  <Group justify="space-between" mr="xs">
                    <Stack gap={2}>
                      <Text fw={600}>{ownerTitle}</Text>
                      <Text size="sm" c="dimmed">
                        {contact ? `${contact} · ` : ''}Оновлено {formatDateTime(cart.updatedAt)} · Позицій {cart.items.length}
                      </Text>
                    </Stack>
                    <Text fw={600}>{formatMoney(cart.subtotal)}</Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {cart.customerId && (
                      <Text size="xs">
                        <Link to={`/sales/customers/accounts/${cart.customerId}`} onClick={onNavigate}>
                          Відкрити кабінет покупця →
                        </Link>
                      </Text>
                    )}
                    {cart.items.map(line => (
                      <Group key={line.productId} justify="space-between" className="orders-cart-product">
                        <Stack gap={0}>
                          <Text size="sm" fw={500}>
                            <Link to={`/catalog/products/${line.productId}`} onClick={onNavigate}>{line.name}</Link>
                          </Text>
                          <Text size="xs" c="dimmed">{line.sku || line.productId} · Доступно {line.availableQuantity} шт.</Text>
                        </Stack>
                        <Text size="sm">{line.quantity} шт. × {formatMoney(line.unitPrice)}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            )
          })}
        </Accordion>}
    </Stack>
  )
}

export function OpenCarts({ onClose }: { onClose: () => void }) {
  return (
    <AppEditorModal opened onClose={onClose} className="orders-carts" title={<MetricLabel icon={IconShoppingCart}>Відкриті кошики покупців</MetricLabel>} size="standard">
      <OpenCartsList onNavigate={onClose} />
    </AppEditorModal>
  )
}
