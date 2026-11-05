import { Alert, Button, Stack } from '@mantine/core'
import { IconInfoCircle, IconRefresh } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { TableChip } from '@/shared/ui/TableChip'
import { getPaymentSettings, type PaymentSettings } from '../api/settingsApi'
import { SectionCard } from '../components/SectionCard'
import { modeChip, PAYMENT_METHODS, providerLabel, receiptMomentLabel, receiptMomentTone } from '../lib/paymentLabels'
import './settings.css'

export function PaymentSettingsPage() {
  const payments = useApiQuery('settings-payments', () => getPaymentSettings())

  return (
    <div className="settings-page">
      <PageHeader
        title="Оплата й чеки"
        actions={
          <Button variant="default" leftSection={<IconRefresh size={16} stroke={1.8} />} loading={payments.isFetching} onClick={payments.reload}>
            Оновити
          </Button>
        }
      />
      {payments.status === 'ready' && payments.data ? (
        <PaymentStatus value={payments.data} />
      ) : payments.status === 'error' || payments.status === 'forbidden' ? (
        <PageState
          kind={payments.status}
          description={problemMessage(payments.problem, 'Перевірте, що API працює, і спробуйте ще раз.')}
          onRetry={payments.status === 'error' ? payments.reload : undefined}
        />
      ) : (
        <PageState kind="loading" />
      )}
    </div>
  )
}

function PaymentStatus({ value }: { value: PaymentSettings }) {
  const paymentMode = modeChip(value.mode)
  const fiscalMode = modeChip(value.fiscalMode)
  return (
    <Stack gap="lg" className="settings-form">
      <p className="settings-lead">Як магазин приймає оплату й видає фіскальні чеки. Сторінка лише для перегляду.</p>
      <Alert color="gray" variant="light" icon={<IconInfoCircle size={18} />}>
        Провайдер, ключі й режим роботи задаються в конфігурації сервера, а не в консолі: так їх не змінити випадково. Щоб змінити, зверніться до розробника.
      </Alert>

      <div className="settings-columns">
        <SectionCard title="Оплата карткою онлайн">
          <dl className="settings-facts">
            <dt>Провайдер</dt>
            <dd>{providerLabel(value.provider)}</dd>
            <dt>Режим</dt>
            <dd>
              <TableChip dot tone={paymentMode.tone} value={paymentMode.label} />
            </dd>
            <dt>Остання звірка оплат</dt>
            <dd className="app-number">{value.lastReconcileAt ? formatDateTime(value.lastReconcileAt) : <span className="settings-muted">ще не було</span>}</dd>
          </dl>
          <p className="settings-note">
            Звірка — фонове завдання, що перевіряє статуси оплат у провайдера. Стан і запуск — у <Link to="/system/integrations">Система → Інтеграції</Link>.
          </p>
        </SectionCard>

        <SectionCard title="Фіскальні чеки">
          <dl className="settings-facts">
            <dt>Каса</dt>
            <dd>{providerLabel(value.fiscalProvider)}</dd>
            <dt>Режим</dt>
            <dd>
              <TableChip dot tone={fiscalMode.tone} value={fiscalMode.label} />
            </dd>
          </dl>
          <p className="settings-note">
            {value.fiscalProvider.toLowerCase() === 'disabled'
              ? 'Каса вимкнена, тому сайт не видає чеки автоматично.'
              : 'Чеки й повернення по замовленню видно в картці замовлення.'}
          </p>
        </SectionCard>
      </div>

      <SectionCard title="Коли видається чек" description="Момент видачі чека для кожного способу оплати. Його визначає бухгалтер магазину.">
        <ul className="settings-moments">
          {PAYMENT_METHODS.map((method) => (
            <li key={method.key}>
              <span className="settings-moment-method">
                <span>{method.label}</span>
                <span className="settings-muted">{method.hint}</span>
              </span>
              <TableChip tone={receiptMomentTone(value.issueOn?.[method.key])} value={receiptMomentLabel(value.issueOn?.[method.key])} />
            </li>
          ))}
        </ul>
      </SectionCard>
    </Stack>
  )
}
