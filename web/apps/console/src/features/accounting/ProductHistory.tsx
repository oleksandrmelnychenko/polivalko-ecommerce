import { Pagination, Stack, Table, Text, Title } from '@mantine/core'
import { Link, useSearchParams } from 'react-router-dom'
import type { components } from '@polivalko/shared/api/schema'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { Grid } from './RegisterTable'
import { kindName, money, statusNames, useRegister, type Page } from './api'

export function ProductHistory() {
  const [params, setParams] = useSearchParams()
  const data = useRegister<Page<components['schemas']['ProductMovement']>>('product-history?' + params)
  const result = data.data
  if (!result) return <PageState kind={data.status === 'ready' ? 'empty' : data.status} onRetry={data.reload} />
  return (
    <Stack>
      <PageHeader title="Історія товару" />
      <Title order={2}>{result.items[0]?.title || 'Історія товару'}</Title>
      <Text size="sm">
        Код товару · {params.get('productRef')} · Записів · {result.total}
      </Text>
      <Grid columns={['Дата', 'Документ', 'Статус', 'Товар у документі', 'Склад', 'Кількість', 'Ціна', 'Сума']}>
        {result.items.map((r) => (
          <Table.Tr key={r.documentId + ':' + r.position}>
            <Table.Td>{r.day || '—'}</Table.Td>
            <Table.Td>
              <Link to={'/accounting/documents/' + r.documentId}>
                {kindName(r)} № {r.number || '—'}
              </Link>
            </Table.Td>
            <Table.Td>{statusNames[r.status ?? ''] ?? r.status ?? '—'}</Table.Td>
            <Table.Td>
              {r.title} {r.sku}
            </Table.Td>
            <Table.Td>{r.store ?? '—'}</Table.Td>
            <Table.Td>{r.quantity ?? '—'}</Table.Td>
            <Table.Td>{money(r.price)}</Table.Td>
            <Table.Td>{money(r.total, r.currency)}</Table.Td>
          </Table.Tr>
        ))}
      </Grid>
      {result.total > 50 && (
        <Pagination
          total={Math.ceil(result.total / 50)}
          value={Number(params.get('page') || 1)}
          onChange={(p) => {
            const next = new URLSearchParams(params)
            next.set('page', String(p))
            setParams(next)
          }}
        />
      )}
    </Stack>
  )
}
