import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { components } from '@polivalko/shared/api/schema'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { problemMessage } from '@/shared/api/problem'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { Grid } from './RegisterTable'
import { InactiveProductCards } from './InactiveProductCards'
import { save, useRegister, type Ref } from './api'

type S = components['schemas']
type Row = S['InventoryRow']
const descriptions: Record<string, string> = {
  ready: 'Готово до підтвердження',
  confirmed: 'Введено',
  reference: 'Довідковий звіт',
  incomplete: 'Перевірити повноту частин',
  store: 'Перевірити дату або склад',
  duplicate: 'Код повторюється',
  unmatched: 'Немає точного збігу в каталозі',
  quantity: 'Перевірити кількість',
  difference: 'Не сходиться з даними джерела',
  reserved: 'Є резерв у джерелі',
  existing: 'Вже є залишок або рух',
}
const kinds: Record<string, string> = {
  cutover: 'Залишок на дату переходу',
  balances: 'Залишок і резерв',
  reference: 'Попередня оцінка',
  inactive: 'Деактивовані товари',
  unknown: 'Інший формат',
}

export function InventoryReview() {
  const [params, setParams] = useSearchParams()
  const reports = useRegister<S['InventoryReport'][]>('inventory-reports')
  const refs = useRegister<{ organizations: Ref[] }>('references')
  const report = reports.data?.find((r) => r.id === params.get('report')) ?? reports.data?.[0]
  const org = refs.data?.organizations.find((r) => r.id === params.get('org'))
  function filter(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    next.set('view', 'inventory')
    next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  return (
    <Stack>
      <PageHeader title="Звірка складських залишків" />
      <Group justify="space-between">
        <Title order={2}>Звірка складських залишків</Title>
        <Button component={Link} to="/accounting/warehouse" variant="default">
          Складські залишки
        </Button>
      </Group>
      <Group align="end">
        <Select
          label="Вихідний звіт"
          searchable
          w={420}
          value={report?.id ?? null}
          data={(reports.data ?? []).map((r) => ({
            value: r.id,
            label: [r.storeName, r.day, kinds[r.kind], r.firstRow != null ? 'з рядка ' + r.firstRow : null]
              .filter(Boolean)
              .join(' · '),
          }))}
          onChange={(v) => filter('report', v)}
        />
        <Select
          label="Організація для початкового залишку"
          searchable
          clearable
          placeholder="Оберіть організацію"
          value={org?.id ?? null}
          data={(refs.data?.organizations ?? []).map((r) => ({ value: r.id, label: r.title }))}
          onChange={(v) => filter('org', v)}
        />
      </Group>
      <Group align="end">
        <TextInput
          label="Товар у звіті"
          placeholder="Код або назва"
          maxLength={160}
          value={params.get('q') ?? ''}
          onChange={(e) => filter('q', e.currentTarget.value)}
        />
        <Select
          label="Стан звірки"
          value={params.get('status') ?? 'all'}
          onChange={(v) => filter('status', v === 'all' ? null : v)}
          data={[
            { value: 'all', label: 'Усі рядки' },
            { value: 'review', label: 'Усі винятки' },
            ...Object.entries(descriptions).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Select
          label="Кількість у джерелі"
          clearable
          placeholder="Усі залишки"
          value={params.get('amount')}
          onChange={(v) => filter('amount', v)}
          data={[
            { value: 'positive', label: 'Більше нуля' },
            { value: 'zero', label: 'Нульові' },
            { value: 'negative', label: 'Від’ємні' },
          ]}
        />
      </Group>
      {refs.status === 'error' && (
        <Button variant="subtle" onClick={refs.reload}>
          Завантажити організації знову
        </Button>
      )}
      {!org && (
        <Text size="sm" c="dimmed">
          Оберіть організацію, щоб перевірити наявні рухи перед введенням залишків.
        </Text>
      )}
      {report ? (
        <InventoryRows
          key={report.id + params.toString()}
          report={report}
          org={org}
          params={params}
          changePage={(p) => filter('page', String(p))}
        />
      ) : (
        <PageState
          kind={reports.status === 'ready' ? 'empty' : reports.status}
          title="Складських звітів немає"
          onRetry={reports.reload}
        />
      )}
    </Stack>
  )
}

function InventoryRows({
  report,
  org,
  params,
  changePage,
}: {
  report: S['InventoryReport']
  org?: Ref
  params: URLSearchParams
  changePage: (page: number) => void
}) {
  const filter = new URLSearchParams(params)
  filter.delete('view')
  filter.delete('report')
  const url = 'inventory-reports/' + report.id
  const query = useRegister<S['InventoryPage']>(url + '?' + filter)
  const [selected, setSelected] = useState<number[]>([])
  const [confirm, setConfirm] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { can } = usePermissions()
  const editable = !!org && can(PermissionKeys.Accounting.Opening)
  const rows = query.data?.items ?? []
  const ready = rows.filter((r) => r.status === 'ready')
  const chosen = rows.filter((r) => selected.includes(r.position))
  function toggle(r: Row) {
    setSelected((v) => (v.includes(r.position) ? v.filter((p) => p !== r.position) : [...v, r.position]))
    setMessage('')
  }
  async function submit() {
    if (!editable || !chosen.length || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await save(url + '/confirm', {
        orgId: org!.id,
        storeId: chosen[0].storeId,
        lines: chosen.map((r) => ({ position: r.position, productId: r.productId, quantity: r.quantity })),
      })
      if (result.response.ok) {
        setMessage('Початкові залишки введено · ' + chosen.length)
        setSelected([])
        setConfirm(false)
        query.reload()
      } else {
        setError(problemMessage(result.error, 'Не вдалося ввести залишки.'))
        setConfirm(false)
        setSelected([])
        query.reload()
      }
    } catch {
      setError('Немає відповіді сервера. Можна повторити підтвердження тих самих рядків.')
    } finally {
      setBusy(false)
    }
  }
  if (!query.data) return <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={query.reload} />
  const counts = query.data.counts
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        {report.sourceId} · товарних рядків у звіті {report.rows}
      </Text>
      {report.kind === 'cutover' && <InactiveProductCards reportUrl={url} reloadRows={query.reload} />}
      <Group gap="lg">
        {counts.map((c) => (
          <Text size="sm" key={c.status}>
            {descriptions[c.status]} · <b>{c.count}</b>
          </Text>
        ))}
      </Group>
      <Group justify="space-between">
        <Text size="sm">За фільтром · {query.data.total}</Text>
        {editable && ready.length > 0 && (
          <Group>
            <Checkbox
              label="Готові на цій сторінці"
              checked={selected.length === ready.length}
              indeterminate={selected.length > 0 && selected.length < ready.length}
              onChange={(e) => setSelected(e.currentTarget.checked ? ready.map((r) => r.position) : [])}
            />
            <Button
              disabled={!chosen.length}
              onClick={() => {
                setError('')
                setConfirm(true)
              }}
            >
              Перевірити вибрані ({chosen.length})
            </Button>
          </Group>
        )}
      </Group>
      {message && <Alert color="green">{message}</Alert>}
      {error && !confirm && <Alert color="red">{error}</Alert>}
      {rows.length ? (
        <Grid columns={['Рядок', 'Код', 'Товар у джерелі', 'Товар каталогу', 'Залишок', 'Резерв у джерелі', 'Стан']}>
          {rows.map((r) => (
            <Table.Tr key={r.position}>
              <Table.Td>
                {editable && r.status === 'ready' ? (
                  <Checkbox
                    label={String(r.position)}
                    checked={selected.includes(r.position)}
                    onChange={() => toggle(r)}
                  />
                ) : (
                  r.position
                )}
              </Table.Td>
              <Table.Td>{r.code}</Table.Td>
              <Table.Td>{r.title}</Table.Td>
              <Table.Td>
                {r.productId ? <Link to={'/catalog/products/' + r.productId}>{r.productName}</Link> : '—'}
              </Table.Td>
              <Table.Td>
                {r.quantityText ?? '—'} {r.unit}
              </Table.Td>
              <Table.Td>{r.booked ?? '—'}</Table.Td>
              <Table.Td>{descriptions[r.status]}</Table.Td>
            </Table.Tr>
          ))}
        </Grid>
      ) : (
        <Text>Рядків за цими умовами немає.</Text>
      )}
      {query.data.total > 50 && (
        <Pagination
          value={Number(params.get('page')) || 1}
          total={Math.ceil(query.data.total / 50)}
          onChange={changePage}
        />
      )}
      <Modal
        opened={confirm}
        onClose={() => {
          if (!busy) setConfirm(false)
        }}
        title="Підтвердження початкових залишків"
        size="lg"
      >
        <Stack>
          <Text fw={600}>
            {org?.title} / {report.storeName}
          </Text>
          <Text>Дата залишків · {report.day}</Text>
          <Grid columns={['Рядок', 'Товар', 'Звірена кількість']}>
            {chosen.map((r) => (
              <Table.Tr key={r.position}>
                <Table.Td>{r.position}</Table.Td>
                <Table.Td>{r.productName}</Table.Td>
                <Table.Td>
                  {r.quantityText} {r.unit}
                </Table.Td>
              </Table.Tr>
            ))}
          </Grid>
          <Text size="sm">
            Підтвердження запише початкову кількість на цей склад. Вибір складу для магазину виконується окремо.
          </Text>
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="end">
            <Button variant="default" disabled={busy} onClick={() => setConfirm(false)}>
              Назад
            </Button>
            <Button loading={busy} onClick={submit}>
              Ввести залишки ({chosen.length})
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
