import { Button } from '@mantine/core'
import { IconClockHour4, IconCreditCard, IconReceipt, IconRefresh } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { TableChip } from '@/shared/ui/TableChip'
import { getPaymentSettings, type PaymentSettings } from '../api/settingsApi'
import { SettingsCard, SettingsHero, SettingsSectionList, useSettingsSection, type SettingsSection } from '../components/SettingsSplit'
import { modeChip, PAYMENT_METHODS, providerLabel, receiptMomentLabel, receiptMomentTone } from '../lib/paymentLabels'
import './settings.css'

type PaymentSectionKey = 'card' | 'fiscal' | 'moments'

const SECTION_KEYS: readonly PaymentSectionKey[] = ['card', 'fiscal', 'moments']

const CONFIG_NOTE = 'Провайдера, ключі й режим роботи розробник задає в конфігурації сервера, тому в консолі їх випадково не змінити. Щоб змінити, зверніться до розробника.'

export function PaymentSettingsPage() {
  const payments = useApiQuery('settings-payments', () => getPaymentSettings())

  return (
    <ListPage>
      <PageHeader
        title="Оплата й чеки"
        actions={
          <Button variant="default" leftSection={<IconRefresh size={16} stroke={1.8} />} loading={payments.isFetching} onClick={payments.reload}>
            Оновити
          </Button>
        }
      />
      {payments.data ? (
        <PaymentStatus value={payments.data} />
      ) : payments.status === 'error' || payments.status === 'forbidden' ? (
        <PageState
          kind={payments.status}
          description={problemMessage(payments.problem, 'Спробуйте ще раз. Якщо помилка повториться, повідомте розробника.')}
          onRetry={payments.status === 'error' ? payments.reload : undefined}
        />
      ) : (
        <PageState kind="loading" />
      )}
    </ListPage>
  )
}

function PaymentStatus({ value }: { value: PaymentSettings }) {
  const [active, select] = useSettingsSection(SECTION_KEYS)
  const paymentMode = modeChip(value.mode)
  const fiscalMode = modeChip(value.fiscalMode)
  const automatic = PAYMENT_METHODS.filter((method) => receiptMomentTone(value.issueOn?.[method.key]) === 'success').length

  const sections: SettingsSection<PaymentSectionKey>[] = [
    { key: 'card', name: 'Оплата карткою онлайн', hint: providerLabel(value.provider), icon: IconCreditCard, state: <TableChip dot tone={paymentMode.tone} value={paymentMode.label} /> },
    { key: 'fiscal', name: 'Фіскальні чеки', hint: providerLabel(value.fiscalProvider), icon: IconReceipt, state: <TableChip dot tone={fiscalMode.tone} value={fiscalMode.label} /> },
    {
      key: 'moments',
      name: 'Коли видається чек',
      hint: 'Для кожного способу оплати',
      icon: IconClockHour4,
      state: automatic ? <TableChip dot tone="success" value={`Автоматично: ${automatic} з ${PAYMENT_METHODS.length}`} /> : <TableChip dot tone="neutral" value="Не видається" />,
    },
  ]
  const section = sections.find((item) => item.key === active) ?? sections[0]

  return (
    <ListPageBody>
      <div className="app-split-layout settings-form">
        <SettingsSectionList label="Оплата й чеки" sections={sections} active={active} onSelect={select} top={<p className="settings-list-note">Сторінка лише для перегляду. {CONFIG_NOTE}</p>} />

        <section key={active} className="app-split-detail" aria-label={section.name}>
          {active === 'card' ? (
            <>
              <SettingsHero section={section} kicker="Оплата й чеки" description="Як магазин приймає оплату карткою на сайті." />
              <SettingsCard title="Стан">
                <dl className="app-split-fields">
                  <div>
                    <dt>Провайдер</dt>
                    <dd>{providerLabel(value.provider)}</dd>
                  </div>
                  <div>
                    <dt>Режим</dt>
                    <dd>
                      <TableChip dot tone={paymentMode.tone} value={paymentMode.label} />
                    </dd>
                  </div>
                  <div>
                    <dt>Остання звірка оплат</dt>
                    <dd>{value.lastReconcileAt ? formatDateTime(value.lastReconcileAt) : <span className="app-split-value-empty">ще не було</span>}</dd>
                  </div>
                </dl>
                <p className="settings-note">
                  Звірка у фоні перевіряє статуси оплат у провайдера. Її стан і запуск дивіться в розділі <Link to="/system/integrations">Система → Інтеграції</Link>.
                </p>
              </SettingsCard>
            </>
          ) : null}

          {active === 'fiscal' ? (
            <>
              <SettingsHero section={section} kicker="Оплата й чеки" description="Як магазин видає фіскальні чеки через програмну касу." />
              <SettingsCard title="Стан">
                <dl className="app-split-fields">
                  <div>
                    <dt>Каса</dt>
                    <dd>{providerLabel(value.fiscalProvider)}</dd>
                  </div>
                  <div>
                    <dt>Режим</dt>
                    <dd>
                      <TableChip dot tone={fiscalMode.tone} value={fiscalMode.label} />
                    </dd>
                  </div>
                </dl>
                <p className="settings-note">
                  {value.fiscalProvider.toLowerCase() === 'disabled' ? 'Каса вимкнена, тому сайт не видає чеки автоматично.' : 'Чеки й повернення по замовленню видно в картці замовлення.'}
                </p>
              </SettingsCard>
            </>
          ) : null}

          {active === 'moments' ? (
            <>
              <SettingsHero section={section} kicker="Оплата й чеки" description="Момент видачі чека для кожного способу оплати визначає бухгалтер магазину." />
              <SettingsCard title="Способи оплати">
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
              </SettingsCard>
            </>
          ) : null}
        </section>
      </div>
    </ListPageBody>
  )
}
