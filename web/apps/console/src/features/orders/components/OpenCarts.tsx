import { Accordion, Group, Stack, Text } from '@mantine/core'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { useState } from 'react'
import { api } from '@/shared/api/client'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { PageState } from '@/shared/ui/PageState'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { useSalesRefresh } from '../lib/useSalesRefresh'

export function OpenCarts({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(1)
  const carts = useApiQuery('open-carts:' + page, () =>
    api.GET('/api/v1/console/orders/open-carts', { params: { query: { page } }, cache: 'no-store' }),
  )
  useSalesRefresh(() => { if (!carts.isFetching) carts.reload() })
  const data = carts.data
  return (
    <AppEditorModal opened onClose={onClose} title="Відкриті кошики покупців" size="standard">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm">{data && `Кошиків: ${data.totalItems}`}</Text>
          <Paginator page={page} pageSize={20} totalPages={data?.totalPages} isLoading={carts.isFetching}
            onPageChange={setPage} onRefresh={carts.reload} />
        </Group>
        {carts.status !== 'ready' ? <PageState kind={carts.status} onRetry={carts.reload} /> :
          !data?.items.length ? <Text size="sm">{page === 1 ? 'Відкритих кошиків поки немає.' : 'На цій сторінці вже немає кошиків.'}</Text> :
          <Accordion variant="separated">
            {data.items.map(cart => (
              <Accordion.Item key={cart.id} value={cart.id}>
                <Accordion.Control>
                  <Group justify="space-between" mr="xs">
                    <Stack gap={2}>
                      <Text fw={600}>{cart.isGuest ? 'Гість' : 'Зареєстрований покупець'} · {cart.id.slice(-8)}</Text>
                      <Text size="sm" c="dimmed">Оновлено {formatDateTime(cart.updatedAt)} · Позицій {cart.items.length}</Text>
                    </Stack>
                    <Text fw={600}>{formatMoney(cart.subtotal)}</Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    {cart.items.map(line => (
                      <Group key={line.productId} justify="space-between">
                        <Stack gap={0}>
                          <Text size="sm" fw={500}>{line.name}</Text>
                          <Text size="xs" c="dimmed">{line.sku || line.productId} · Доступно {line.availableQuantity} шт.</Text>
                        </Stack>
                        <Text size="sm">{line.quantity} шт. × {formatMoney(line.unitPrice)}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>}
      </Stack>
    </AppEditorModal>
  )
}
