import { Alert, Button, Checkbox, Group, Modal, Select, Stack, Table, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { IconBuildingStore, IconClipboardCheck, IconScale } from '@tabler/icons-react'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { Link } from 'react-router-dom'
import type { components } from '@polivalko/shared/api/schema'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { problemMessage } from '@/shared/api/problem'
import { PageState } from '@/shared/ui/PageState'
import { Grid } from './RegisterTable'
import { PaymentForm } from './InvoiceActions'
import { money, save, useRegister, type Balance, type Ref, type Report } from './api'

type Opening = components['schemas']['PartnerOpening']
type Payment = components['schemas']['RecordedPayment']
const directions = [
  { value: 'receivable', label: 'Контрагент винен нам' },
  { value: 'payable', label: 'Ми винні контрагенту' },
]

export function OpeningConfirmation({
  row,
  report,
  close,
  saved,
}: {
  row: Balance
  report: Report
  close: () => void
  saved: () => void
}) {
  const [dialog, setDialog] = useState<'open' | 'closed' | 'saved'>('open')
  const refs = useRegister<{ organizations: Ref[] }>('references')
  const [org, setOrg] = useState<string | null>(null)
  const [direction, setDirection] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    if (!org || !direction || !checked || busy) return
    setBusy(true)
    try {
      const result = await save('balance-reports/' + report.id + '/openings', {
        position: row.position,
        partnerId: row.linkedPartner,
        orgId: org,
        direction,
        closing: row.closing,
      })
      if (result.response.ok) setDialog('saved')
      else setError(problemMessage(result.error, 'Не вдалося підтвердити борг.'))
    } catch {
      setError('Немає зв’язку з сервером. Повторіть підтвердження.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <AppEditorModal opened={dialog === 'open'} className="ledger-editor balance-editor"
      onClose={() => { if (!busy) setDialog('closed') }} onExitTransitionEnd={dialog === 'saved' ? saved : close}
      title={<MetricLabel icon={IconClipboardCheck}>Підтвердження початкового боргу</MetricLabel>}
      footer={<Group gap="xs">
        <Button variant="default" disabled={busy} onClick={() => setDialog('closed')}>Скасувати</Button>
        <Button loading={busy} disabled={!checked || !org || !direction} onClick={confirm}>Зарахувати борг</Button>
      </Group>}>
      <Stack gap="sm">
        <section className="ledger-form-block">
          <MetricLabel icon={IconBuildingStore}>{row.partnerTitle}</MetricLabel>
          <Text size="sm" c="dimmed">{row.account} · {report.day} · рядок {row.position}</Text>
          <Text size="xs" c="dimmed">{report.sourceId}</Text>
          <div className="balance-value"><span>Залишок у звіті</span><strong>{money(row.closing, 'UAH')}</strong></div>
        </section>
        <section className="ledger-form-block">
          <MetricLabel icon={IconScale}>Облік боргу</MetricLabel>
          <Select
            label="Організація" placeholder="Оберіть організацію"
            searchable
            value={org}
            onChange={(v) => {
              setOrg(v)
              setChecked(false)
            }}
            data={(refs.data?.organizations ?? []).map((r) => ({ value: r.id, label: r.title }))}
          />
          {refs.status === 'error' && (
            <Button variant="subtle" onClick={refs.reload}>
              Завантажити організації ще раз
            </Button>
          )}
          <Select
            label="Хто кому винен" placeholder="Оберіть напрям"
            value={direction}
            onChange={(v) => {
              setDirection(v)
              setChecked(false)
            }}
            data={directions}
          />
          {direction && (
            <Text>
              {directions.find((d) => d.value === direction)?.label} ·{' '}
              <b>{money(row.closing?.replace(/^[-+]/, '') ?? null, 'UAH')}</b>
            </Text>
          )}
        </section>
        {!report.openingReportId && (
          <Alert color="blue">Перший підтверджений рядок закріпить цей звіт як джерело початкових боргів.</Alert>
        )}
        <Checkbox
          checked={checked}
          onChange={(e) => setChecked(e.currentTarget.checked)}
          label="Звірено контрагента, організацію, напрям і суму. Цей борг не включений до нових накладних консолі."
        />
        {error && <Alert color="red">{error}</Alert>}
      </Stack>
    </AppEditorModal>
  )
}

function OpeningPayments({ opening }: { opening: Opening }) {
  const query = useRegister<Payment[]>('openings/' + opening.id + '/payments')
  if (!query.data) return <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={query.reload} />
  if (!query.data.length) return <Text size="sm">Зареєстрованих оплат ще немає.</Text>
  return (
    <Grid columns={['Дата', 'Спосіб', 'Каса або рахунок', 'Документ', 'Сума']}>
      {query.data.map((p) => (
        <Table.Tr key={p.id}>
          <Table.Td>{p.day}</Table.Td>
          <Table.Td>{p.method === 'bank' ? 'Банк' : 'Готівка'}</Table.Td>
          <Table.Td>{p.accountTitle}</Table.Td>
          <Table.Td>{p.reference}</Table.Td>
          <Table.Td>{money(p.amount, 'UAH')}</Table.Td>
        </Table.Tr>
      ))}
    </Grid>
  )
}

export function PartnerOpeningList({ partnerId, refresh }: { partnerId: string; refresh: () => void }) {
  const query = useRegister<Opening[]>('partners/' + partnerId + '/openings')
  const [history, setHistory] = useState<Opening | null>(null)
  const [pay, setPay] = useState<Opening | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { can } = usePermissions()
  async function submit(body: unknown) {
    if (!pay || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await save('openings/' + pay.id + '/payments', body)
      if (!result.response.ok) setError(problemMessage(result.error, 'Не вдалося зберегти оплату.'))
      else {
        setPay(null)
        refresh()
      }
      query.reload()
    } catch {
      setError('Немає зв’язку з сервером. Повторіть операцію.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Stack gap="xs">
      <Title order={4}>Підтверджені початкові борги</Title>
      {!query.data ? (
        <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={query.reload} />
      ) : !query.data.length ? (
        <Text size="sm" c="dimmed">
          Для цього контрагента ще не підтверджували початкового боргу.
        </Text>
      ) : (
        <Grid columns={['Джерело', 'Організація', 'Напрям', 'Початкова сума', 'Залишилось', 'Операції']}>
          {query.data.map((o) => (
            <Table.Tr key={o.id}>
              <Table.Td>
                <Link to={'/accounting/balances?report=' + o.reportId + '&position=' + o.position}>
                  {o.day} · рядок {o.position}
                </Link>
                <Text size="xs">{o.account}</Text>
              </Table.Td>
              <Table.Td>{o.organization}</Table.Td>
              <Table.Td>{directions.find((d) => d.value === o.direction)?.label}</Table.Td>
              <Table.Td>{money(o.amount, 'UAH')}</Table.Td>
              <Table.Td>{money(o.due, 'UAH')}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Button variant="subtle" size="compact-xs" onClick={() => setHistory(o)}>
                    Історія оплат
                  </Button>
                  {can(PermissionKeys.Accounting.Pay) && Number(o.due) > 0 && (
                    <Button
                      variant="default"
                      size="compact-xs"
                      onClick={() => {
                        setPay(o)
                        setError('')
                      }}
                    >
                      Зареєструвати оплату
                    </Button>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Grid>
      )}
      {history && (
        <Modal
          opened
          onClose={() => setHistory(null)}
          title={'Оплати початкового боргу · ' + history.account}
          size="lg"
        >
          <OpeningPayments opening={history} />
        </Modal>
      )}
      {pay && (
        <PaymentForm
          due={query.data?.find((o) => o.id === pay.id)?.due ?? pay.due}
          minDay={pay.day}
          purchase={pay.direction === 'payable'}
          busy={busy}
          close={() => {
            if (!busy) setPay(null)
          }}
          error={error}
          submit={submit}
          balanceLabel="Залишок початкового боргу"
        />
      )}
    </Stack>
  )
}
