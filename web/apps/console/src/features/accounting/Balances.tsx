import { Alert, Button, Group, Modal, Pagination, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import type { components } from '@polivalko/shared/api/schema'
import { Link, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { withCsrf } from '@/shared/api/csrf'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { Grid } from './RegisterTable'
import { OpeningConfirmation } from './PartnerOpenings'
import { money, read, useRegister, type Balance, type Report, type Page, type Partner, type Ref } from './api'

const columns = ['Контрагент', 'Аналітичний рахунок', 'На початок', 'Прихід', 'Розхід', 'Залишок', 'Розбіжність']
const amounts = ['opening', 'incoming', 'outgoing', 'closing', 'difference'] as const
function Amounts({ row }: { row: Balance }) {
  return amounts.map((k, i) => (
    <Table.Td key={k} className="register-money">
      {k === 'difference'
        ? money(row[k])
        : (row.sourceAmounts[i]?.split('\n').map((line, n) => <div key={n}>{line}</div>) ?? '—')}
    </Table.Td>
  ))
}

export function Balances() {
  const [params, setParams] = useSearchParams()
  const history =
    params.get('view') === 'reports' ||
    (!params.has('view') && ['report', 'position', 'q', 'mode'].some((k) => params.has(k)))
  return (
    <Stack>
      <PageHeader title="Взаєморозрахунки" />
      <Title order={2}>Взаєморозрахунки</Title>
      <Group gap="xs">
        <Button
          variant={history ? 'default' : 'filled'}
          aria-pressed={!history}
          onClick={() => setParams({ view: 'current' })}
        >
          Поточні борги
        </Button>
        <Button
          variant={history ? 'filled' : 'default'}
          aria-pressed={history}
          onClick={() => setParams({ view: 'reports' })}
        >
          Звірка перенесення
        </Button>
      </Group>
      {history ? <BalanceReports /> : <CurrentBalances />}
    </Stack>
  )
}

function CurrentBalances() {
  const [params, setParams] = useSearchParams()
  const orgs = useRegister<{ organizations: Ref[] }>('references')
  const queryParams = new URLSearchParams(params)
  queryParams.delete('view')
  const query = useRegister<Page<components['schemas']['CurrentPartnerBalance']>>('current-balances?' + queryParams)
  const page = Math.max(1, Number(params.get('page')) || 1)
  function filter(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    next.set('view', 'current')
    next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        До сплати й до отримання за початковими боргами та проведеними в консолі накладними з урахуванням оплат.
      </Text>
      <Group align="end">
        <TextInput
          label="Контрагент"
          placeholder="Назва або код"
          maxLength={160}
          value={params.get('q') ?? ''}
          onChange={(e) => filter('q', e.currentTarget.value)}
        />
        <Select
          label="Організація"
          placeholder="Усі"
          clearable
          searchable
          data={(orgs.data?.organizations ?? []).map((o) => ({ value: o.id, label: o.title }))}
          value={params.get('org')}
          onChange={(v) => filter('org', v)}
        />
        <Select
          label="Напрям боргу"
          placeholder="Обидва"
          clearable
          data={[
            { value: 'receivable', label: 'До отримання' },
            { value: 'payable', label: 'До сплати' },
          ]}
          value={params.get('direction')}
          onChange={(v) => filter('direction', v)}
        />
      </Group>
      {query.data ? (
        query.data.total > 0 ? (
          <>
            <Grid columns={['Контрагент', 'Організація', 'До отримання', 'До сплати']}>
              {query.data.items.map((r) => (
                <Table.Tr key={[r.partnerId, r.orgId, r.currency].join(':')}>
                  <Table.Td>
                    <Link to={'/accounting/partners/' + r.partnerId}>{r.partner}</Link>
                  </Table.Td>
                  <Table.Td>{r.organization}</Table.Td>
                  <Table.Td>{money(r.receivable, r.currency)}</Table.Td>
                  <Table.Td>{money(r.payable, r.currency)}</Table.Td>
                </Table.Tr>
              ))}
            </Grid>
            {query.data.total > 50 && (
              <Pagination
                value={page}
                total={Math.ceil(query.data.total / 50)}
                onChange={(p) => filter('page', String(p))}
              />
            )}
          </>
        ) : (
          <PageState
            kind="empty"
            title="Відкритих боргів за цими умовами немає"
            description="Початковий борг з’являється після підтвердження рядка у звірці перенесення."
          />
        )
      ) : (
        <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={query.reload} />
      )}
    </Stack>
  )
}

function BalanceReports() {
  const [params, setParams] = useSearchParams()
  const [linking, setLinking] = useState<Balance | null>(null)
  const [confirming, setConfirming] = useState<Balance | null>(null)
  const { can } = usePermissions()
  const reports = useRegister<Report[]>('balance-reports')
  const id = params.get('report') || reports.data?.[0]?.id
  const report = reports.data?.find((r) => r.id === id)
  const data = useRegister<Balance[]>('balance-reports/' + id, Boolean(id))
  function change(k: string, v: string) {
    const next = new URLSearchParams(params)
    next.delete('position')
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }
  const term = (params.get('q') ?? '').trim().toLocaleLowerCase('uk')
  const mode = params.get('mode') || 'all'
  const position = params.get('position')
  const zero = (v: string | null) => v != null && /^[-+]?0([.]0+)?$/.test(v)
  const eligible = (r: Balance) =>
    !!report?.day &&
    (!report.openingReportId || report.openingReportId === id) &&
    !!r.linkedPartner &&
    !r.openingId &&
    zero(r.difference) &&
    r.closing != null &&
    !zero(r.closing) &&
    r.sourceAmounts.every((v) => v != null && !v.trim().includes('\n'))
  const selected = data.data?.filter(
    (r) =>
      !r.footer &&
      (!position || String(r.position) === position) &&
      (r.partnerTitle ?? '').toLocaleLowerCase('uk').includes(term) &&
      (mode === 'all' ||
        (mode === 'unavailable' && r.difference === null) ||
        (mode === 'difference' && r.difference !== null && !zero(r.difference)) ||
        (mode === 'unlinked' && !r.linkedPartner) ||
        (mode === 'ambiguous' && !r.linkedPartner && r.candidateCount > 1) ||
        (mode === 'ready' && eligible(r)) ||
        (mode === 'confirmed' && !!r.openingId)),
  )
  const footer = data.data?.find((r) => r.footer)
  return (
    <Stack>
      {reports.data && reports.data.length > 0 && (
        <Group align="end">
          <Select
            label="Звіт на дату"
            value={id}
            data={reports.data.map((r) => ({ value: r.id, label: (r.capturedAt || r.day || '') + ' · ' + r.sourceId }))}
            onChange={(v) => change('report', v || '')}
          />
          <TextInput
            label="Контрагент"
            value={params.get('q') || ''}
            placeholder="Пошук за назвою"
            onChange={(e) => change('q', e.currentTarget.value)}
          />
          <Select
            label="Звірка"
            value={mode}
            onChange={(v) => change('mode', v || 'all')}
            data={[
              { value: 'all', label: 'Усі рядки' },
              { value: 'difference', label: 'Є розбіжність' },
              { value: 'unavailable', label: 'Сума або валюта невідома' },
              { value: 'unlinked', label: 'Потрібна прив’язка' },
              { value: 'ambiguous', label: 'Кілька контрагентів з однаковою назвою' },
              { value: 'ready', label: 'Готові до підтвердження боргу' },
              { value: 'confirmed', label: 'Борг підтверджено' },
            ]}
          />
        </Group>
      )}
      {reports.data?.length === 0 ? (
        <PageState kind="empty" title="Звітів про залишки ще немає" />
      ) : !selected ? (
        <PageState
          kind={
            reports.status === 'error' || reports.status === 'forbidden'
              ? reports.status
              : data.status === 'ready'
                ? 'empty'
                : data.status
          }
          onRetry={() => {
            reports.reload()
            data.reload()
          }}
        />
      ) : (
        <>
          <Text size="sm" c="dimmed">
            У таблиці збережено всі суми й позначення валют джерела. Для рядків із позначкою «грн.» розбіжність дорівнює
            залишку зі звіту мінус розрахований залишок (на початок + розхід − прихід).
          </Text>
          {footer && (
            <Grid columns={columns}>
              <Table.Tr>
                <Table.Td>Підсумок усього звіту</Table.Td>
                <Table.Td>—</Table.Td>
                <Amounts row={footer} />
              </Table.Tr>
            </Grid>
          )}
          {report?.openingReportId && (
            <Text size="sm">
              {report.openingReportId === id ? (
                'Цей звіт використовується для початкових боргів.'
              ) : (
                <Link to={'/accounting/balances?report=' + report.openingReportId}>
                  Перейти до звіту, вибраного для початкових боргів
                </Link>
              )}
            </Text>
          )}
          <Group>
            <Text size="sm">Рядків за фільтром · {selected.length}</Text>
            {position && (
              <Button size="compact-xs" variant="subtle" onClick={() => change('position', '')}>
                Показати весь звіт
              </Button>
            )}
          </Group>
          {selected.length ? (
            <Grid columns={columns}>
              {selected.map((r) => (
                <Table.Tr key={r.position}>
                  <Table.Td>
                    {r.linkedPartner ? (
                      <Link to={'/accounting/partners/' + r.linkedPartner}>{r.partnerTitle}</Link>
                    ) : (
                      r.partnerTitle || 'Без назви'
                    )}
                    {!r.linkedPartner && (
                      <Text c="dimmed" size="xs">
                        {r.candidateCount === 1
                          ? 'Один збіг за назвою'
                          : r.candidateCount > 1
                            ? 'Кілька збігів за назвою'
                            : 'Без зв’язку з довідником'}
                      </Text>
                    )}
                    {r.headingPosition && !r.headingConfirmed && can(PermissionKeys.Accounting.Edit) && (
                      <Button size="compact-xs" variant="subtle" onClick={() => setLinking(r)}>
                        {r.linkedPartner ? 'Змінити прив’язку' : 'Прив’язати'}
                      </Button>
                    )}
                    {r.openingId && (
                      <Text size="xs" c="teal">
                        Початковий борг підтверджено
                      </Text>
                    )}
                    {eligible(r) && can(PermissionKeys.Accounting.BalanceOpening) && (
                      <Button size="compact-xs" variant="light" onClick={() => setConfirming(r)}>
                        Підтвердити борг
                      </Button>
                    )}
                  </Table.Td>
                  <Table.Td>{r.account || '—'}</Table.Td>
                  <Amounts row={r} />
                </Table.Tr>
              ))}
            </Grid>
          ) : (
            <PageState kind="empty" title="Рядків за цими умовами немає" />
          )}
        </>
      )}
      {confirming && report && (
        <OpeningConfirmation
          row={confirming}
          report={report}
          close={() => setConfirming(null)}
          saved={() => {
            setConfirming(null)
            reports.reload()
            data.reload()
          }}
        />
      )}
      {id && linking && (
        <LinkPartner
          report={id}
          row={linking}
          close={() => setLinking(null)}
          saved={() => {
            setLinking(null)
            data.reload()
          }}
        />
      )}
    </Stack>
  )
}

function LinkPartner({
  report,
  row,
  close,
  saved,
}: {
  report: string
  row: Balance
  close: () => void
  saved: () => void
}) {
  const [term, setTerm] = useState(row.partnerTitle || '')
  const [choice, setChoice] = useState<string | null>(row.linkedPartner || row.candidate)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const query = useRegister<Page<Partner>>('partners?q=' + encodeURIComponent(term))
  async function confirm() {
    if (!choice || busy) return
    setBusy(true)
    try {
      const result = await withCsrf((headers) =>
        read<string>('balance-reports/' + report + '/partner', {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            headingPosition: row.headingPosition,
            partnerId: choice,
            previous: row.linkedPartner,
          }),
        }),
      )
      if (result.response.ok) saved()
      else
        setError(
          result.response.status === 409
            ? 'Прив’язку вже змінили. Оновіть сторінку.'
            : 'Не вдалося зберегти прив’язку.',
        )
    } catch {
      setError('Немає зв’язку з сервером.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal opened onClose={close} title="Прив’язка до контрагента">
      <Stack>
        <Text>{row.partnerTitle}</Text>
        <TextInput
          label="Пошук у довіднику"
          value={term}
          onChange={(e) => {
            setTerm(e.currentTarget.value)
            setChoice(null)
          }}
        />
        <Select
          label="Контрагент і код"
          value={choice}
          onChange={setChoice}
          data={(query.data?.items ?? []).map((p) => ({ value: p.id, label: p.title + ' · ' + p.sourceId }))}
        />
        {error && <Alert color="red">{error}</Alert>}
        <Button disabled={!choice} loading={busy} onClick={confirm}>
          Зберегти прив’язку
        </Button>
      </Stack>
    </Modal>
  )
}
