import { Alert, Button, Checkbox, SegmentedControl, Select, Stack, Switch, TextInput } from '@mantine/core'
import { IconBrandApple, IconBuildingBank, IconClockHour4, IconCreditCard, IconDeviceFloppy, IconReceipt, IconRefresh } from '@tabler/icons-react'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { TableChip } from '@/shared/ui/TableChip'
import {
  checkFiscal,
  checkPaymentGateway,
  getFiscalSettings,
  getPaymentGateways,
  getPaymentSettings,
  saveFiscalSettings,
  savePaymentGateways,
  type FiscalGateway,
  type PaymentGateways,
  type PaymentSettings,
  type ReceiptMoments,
} from '../api/settingsApi'
import { SettingsCard, SettingsHero, SettingsSectionList, useSettingsSection, type SettingsSection } from '../components/SettingsSplit'
import { modeChip, PAYMENT_METHODS, providerLabel, receiptMomentLabel, receiptMomentTone } from '../lib/paymentLabels'
import './settings.css'

type PaymentSectionKey = 'mono' | 'liqpay' | 'wallets' | 'card' | 'fiscal' | 'moments'

const EDIT_KEYS: readonly PaymentSectionKey[] = ['mono', 'liqpay', 'wallets', 'fiscal', 'moments']
const VIEW_KEYS: readonly PaymentSectionKey[] = ['card', 'fiscal', 'moments']

const FORM_ID = 'settings-payments-form'

const MOMENT_OPTIONS = [
  { value: 'payment', label: 'Одразу після оплати' },
  { value: 'completion', label: 'Коли замовлення виконане' },
  { value: 'none', label: 'Не видавати (чек дає каса магазину)' },
]

function momentsChanged(a: ReceiptMoments, b: ReceiptMoments): boolean {
  return a.card !== b.card || a.cashOnDelivery !== b.cashOnDelivery || a.pickup !== b.pickup
}

function momentsSummary(value: ReceiptMoments): string {
  const automatic = [value.card, value.cashOnDelivery, value.pickup].filter((moment) => moment !== 'none').length
  return automatic ? `Автоматично: ${automatic} з 3` : 'Не видається'
}

export function PaymentSettingsPage() {
  const payments = useApiQuery('settings-payments', () => getPaymentSettings())
  const gateways = useApiQuery('settings-payment-gateways', () => getPaymentGateways())
  const fiscal = useApiQuery('settings-fiscal', () => getFiscalSettings())
  const editable = gateways.status === 'ready' && gateways.data && fiscal.status === 'ready' && fiscal.data
  const settled = payments.data && (gateways.status === 'ready' || gateways.status === 'forbidden' || gateways.status === 'error')

  function reload() {
    payments.reload()
    gateways.reload()
    fiscal.reload()
  }

  if (settled && editable) {
    return (
      <GatewaysForm
        value={payments.data!}
        initial={gateways.data!}
        fiscal={fiscal.data!}
        onFiscalSaved={(saved) => {
          fiscal.setData(saved)
          payments.reload()
        }}
        onSaved={(saved) => {
          gateways.setData(saved)
          payments.reload()
        }}
        onReload={reload}
        busyReload={payments.isFetching || gateways.isFetching || fiscal.isFetching}
      />
    )
  }

  return (
    <ListPage className="settings-page">
      <PageHeader
        title="Оплата й чеки"
        actions={
          <Button variant="default" leftSection={<IconRefresh size={16} stroke={1.8} />} loading={payments.isFetching} onClick={reload}>
            Оновити
          </Button>
        }
      />
      {settled ? (
        <PaymentView value={payments.data!} />
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

/** For staff without the right to change banks: what the shop accepts, without keys. */
function PaymentView({ value }: { value: PaymentSettings }) {
  const [active, select] = useSettingsSection(VIEW_KEYS)
  const paymentMode = modeChip(value.mode)
  const sections = [
    { key: 'card' as const, name: 'Оплата онлайн', hint: providerLabel(value.provider), icon: IconCreditCard, state: <TableChip dot tone={paymentMode.tone} value={paymentMode.label} /> },
    ...commonSections(value),
  ]
  const section = sections.find((item) => item.key === active) ?? sections[0]

  return (
    <ListPageBody>
      <div className="home-workspace settings-form">
        <SettingsSectionList
          label="Оплата й чеки"
          sections={sections}
          active={active}
          onSelect={select}
          top={<p className="settings-list-note">Банки й ключі змінює працівник із правом «Оплата й каса: банки, Checkbox, ключі».</p>}
        />
        <section key={active} className="app-split-detail" aria-label={section.name}>
          {active === 'card' ? (
            <>
              <SettingsHero section={section} kicker="Оплата й чеки" />
              <SettingsCard title="Стан">
                <dl className="app-split-fields">
                  <div>
                    <dt>Банки</dt>
                    <dd>{providerLabel(value.provider)}</dd>
                  </div>
                  <div>
                    <dt>Режим</dt>
                    <dd>
                      <TableChip dot tone={paymentMode.tone} value={paymentMode.label} />
                    </dd>
                  </div>
                  <ReconcileField value={value} />
                </dl>
              </SettingsCard>
            </>
          ) : (
            <CommonDetail active={active} section={section} value={value} />
          )}
        </section>
      </div>
    </ListPageBody>
  )
}

function GatewaysForm({
  value,
  initial,
  fiscal,
  onSaved,
  onFiscalSaved,
  onReload,
  busyReload,
}: {
  value: PaymentSettings
  initial: PaymentGateways
  fiscal: FiscalGateway
  onSaved: (value: PaymentGateways) => void
  onFiscalSaved: (value: FiscalGateway) => void
  onReload: () => void
  busyReload: boolean
}) {
  const [active, select] = useSettingsSection(EDIT_KEYS)
  const [monoEnabled, setMonoEnabled] = useState(initial.mono.enabled)
  const [monoToken, setMonoToken] = useState('')
  const [clearMono, setClearMono] = useState(false)
  const [liqPayEnabled, setLiqPayEnabled] = useState(initial.liqPay.enabled)
  const [publicKey, setPublicKey] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [clearLiqPay, setClearLiqPay] = useState(false)
  const [walletsEnabled, setWalletsEnabled] = useState(initial.wallets.enabled)
  const [walletsProvider, setWalletsProvider] = useState(initial.wallets.provider || 'mono')
  const [cashEnabled, setCashEnabled] = useState(fiscal.enabled)
  const [license, setLicense] = useState('')
  const [cashierLogin, setCashierLogin] = useState('')
  const [cashierPassword, setCashierPassword] = useState('')
  const [clearCash, setClearCash] = useState(false)
  const [moments, setMoments] = useState<ReceiptMoments>(fiscal.issueOn)
  const [busy, setBusy] = useState<'check-mono' | 'check-liqpay' | 'check-cash' | 'save' | null>(null)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const guard = useRef(false)

  const monoHasKey = initial.mono.hasToken && !clearMono
  const liqPayHasKeys = !!initial.liqPay.publicKey && initial.liqPay.hasPrivateKey && !clearLiqPay
  const walletBankOn = walletsProvider === 'liqpay' ? liqPayEnabled : monoEnabled
  const cashHasKeys = fiscal.hasLicenseKey && fiscal.hasPassword && !!fiscal.cashierLogin && !clearCash
  const banksDirty =
    monoEnabled !== initial.mono.enabled || !!monoToken || clearMono || liqPayEnabled !== initial.liqPay.enabled || !!publicKey || !!privateKey || clearLiqPay
    || walletsEnabled !== initial.wallets.enabled || walletsProvider !== (initial.wallets.provider || 'mono')
  const cashDirty =
    cashEnabled !== fiscal.enabled || !!license || !!cashierLogin || !!cashierPassword || clearCash
    || moments.card !== fiscal.issueOn.card || moments.cashOnDelivery !== fiscal.issueOn.cashOnDelivery || moments.pickup !== fiscal.issueOn.pickup

  async function saveCash(): Promise<string | null> {
    const result = await withCsrf((headers) =>
      saveFiscalSettings(headers, {
        revision: fiscal.revision ?? null,
        enabled: cashEnabled,
        licenseKey: license || null,
        cashierLogin: cashierLogin || null,
        cashierPassword: cashierPassword || null,
        clearKeys: clearCash,
        issueOn: moments,
      }),
    )
    if (!result.data) return Object.values(fieldErrors(result.error)).join(' ') || problemMessage(result.error, 'Налаштування каси не збережено.')
    onFiscalSaved(result.data)
    setLicense('')
    setCashierLogin('')
    setCashierPassword('')
    setClearCash(false)
    setMoments(result.data.issueOn)
    return null
  }

  async function run(action: 'check-mono' | 'check-liqpay' | 'check-cash' | 'save') {
    if (guard.current) return
    guard.current = true
    setBusy(action)
    setMessage(null)
    try {
      if (action === 'check-cash') {
        const result = await withCsrf((headers) =>
          checkFiscal(headers, { licenseKey: license || null, cashierLogin: cashierLogin || null, cashierPassword: cashierPassword || null }),
        )
        setMessage(
          result.data
            ? { error: false, text: `${result.data.message} Щоб сайт видавав чеки, увімкніть касу й збережіть.` }
            : { error: true, text: Object.values(fieldErrors(result.error)).join(' ') || problemMessage(result.error, 'Не вдалося перевірити ключі каси.') },
        )
        return
      }

      if (action === 'save' && !banksDirty) {
        const error = cashDirty ? await saveCash() : null
        setMessage(error ? { error: true, text: error } : { error: false, text: cashDirty ? 'Збережено налаштування каси й чеків.' : 'Змін немає.' })
        return
      }

      if (action !== 'save') {
        const provider = action === 'check-mono' ? 'mono' : 'liqpay'
        const result = await withCsrf((headers) =>
          checkPaymentGateway(headers, {
            provider,
            monoToken: provider === 'mono' ? monoToken || null : null,
            liqPayPublicKey: provider === 'liqpay' ? publicKey || null : null,
            liqPayPrivateKey: provider === 'liqpay' ? privateKey || null : null,
          }),
        )
        setMessage(
          result.data
            ? { error: false, text: `${result.data.message} Щоб покупці бачили цей банк, увімкніть його й збережіть.` }
            : { error: true, text: Object.values(fieldErrors(result.error)).join(' ') || problemMessage(result.error, 'Не вдалося перевірити ключі.') },
        )
        return
      }

      const result = await withCsrf((headers) =>
        savePaymentGateways(headers, {
          revision: initial.revision ?? null,
          monoEnabled,
          monoToken: monoToken || null,
          clearMonoToken: clearMono,
          liqPayEnabled,
          liqPayPublicKey: publicKey || null,
          liqPayPrivateKey: privateKey || null,
          clearLiqPayKeys: clearLiqPay,
          walletsEnabled,
          walletsProvider,
        }),
      )
      if (!result.data) {
        setMessage({ error: true, text: Object.values(fieldErrors(result.error)).join(' ') || problemMessage(result.error, 'Налаштування не збережено.') })
        return
      }
      onSaved(result.data)
      setMonoToken('')
      setPublicKey('')
      setPrivateKey('')
      setClearMono(false)
      setClearLiqPay(false)
      const names = result.data.options.map((option) => option.name).join(', ')
      const banks = names ? `Збережено. Покупець бачить: ${names}.` : 'Збережено. Онлайн-оплату вимкнено.'
      const cashError = cashDirty ? await saveCash() : null
      setMessage(cashError ? { error: true, text: `${banks} Але каса: ${cashError}` } : { error: false, text: banks })
    } catch {
      setMessage({ error: true, text: 'Сервер не відповідає. Перевірте з’єднання й повторіть спробу.' })
    } finally {
      guard.current = false
      setBusy(null)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void run('save')
  }

  const offered = initial.options.map((option) => option.name).join(', ')
  const sections: SettingsSection<PaymentSectionKey>[] = [
    { key: 'mono', name: 'monobank', hint: 'Plata by mono: картка будь-якого банку', icon: IconCreditCard, state: bankChip(monoEnabled, monoHasKey, !!monoToken) },
    { key: 'liqpay', name: 'ПриватБанк', hint: 'LiqPay: картка, Приват24', icon: IconBuildingBank, state: bankChip(liqPayEnabled, liqPayHasKeys, !!(publicKey || privateKey)) },
    {
      key: 'wallets',
      name: 'Apple Pay і Google Pay',
      hint: walletsProvider === 'liqpay' ? 'Через ПриватБанк (LiqPay)' : 'Через monobank',
      icon: IconBrandApple,
      state: walletsEnabled ? (
        walletBankOn ? <TableChip dot tone="success" value="Увімкнено" /> : <TableChip dot tone="warning" value="Банк вимкнено" />
      ) : (
        <TableChip dot tone="neutral" value="Вимкнено" />
      ),
    },
    {
      key: 'fiscal',
      name: 'Каса Checkbox',
      hint: fiscal.fiscalNumber ? `ПРРО ${fiscal.fiscalNumber}` : 'Фіскальні чеки через програмну касу',
      icon: IconReceipt,
      state: license || cashierLogin || cashierPassword ? (
        <TableChip dot tone="warning" value="Не збережено" />
      ) : cashEnabled && cashHasKeys ? (
        <TableChip dot tone="success" value="Увімкнено" />
      ) : fiscal.provider === 'Stub' ? (
        <TableChip dot tone="warning" value="Тестова заглушка" />
      ) : (
        <TableChip dot tone="neutral" value={cashHasKeys ? 'Вимкнено' : 'Не підключено'} />
      ),
    },
    {
      key: 'moments',
      name: 'Коли видається чек',
      hint: 'Для кожного способу оплати',
      icon: IconClockHour4,
      state: <TableChip dot tone={momentsChanged(moments, fiscal.issueOn) ? 'warning' : 'neutral'} value={momentsChanged(moments, fiscal.issueOn) ? 'Не збережено' : momentsSummary(moments)} />,
    },
  ]
  const section = sections.find((item) => item.key === active) ?? sections[0]

  return (
    <ListPage className="settings-page">
      <PageHeader
        title="Оплата й чеки"
        actions={
          <>
            <Button variant="default" leftSection={<IconRefresh size={16} stroke={1.8} />} loading={busyReload} disabled={!!busy} onClick={onReload}>
              Оновити
            </Button>
            <Button type="submit" form={FORM_ID} loading={busy === 'save'} disabled={!!busy} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
              Зберегти
            </Button>
          </>
        }
      />
      <ListPageBody>
        <form id={FORM_ID} className="home-workspace settings-form" onSubmit={submit} aria-label="Налаштування оплати">
          <SettingsSectionList
            label="Оплата й чеки"
            sections={sections}
            active={active}
            onSelect={select}
            top={
              <>
                {message ? (
                  <Alert color={message.error ? 'red' : 'green'} role={message.error ? 'alert' : 'status'}>
                    {message.text}
                  </Alert>
                ) : null}
                <p className="settings-list-note">
                  {offered ? `Покупець зараз бачить: ${offered}.` : 'Онлайн-оплата на сайті вимкнена.'}
                  {initial.source === 'environment' ? ' Зараз діють налаштування сервера; після першого збереження діятимуть ці.' : ''}
                </p>
              </>
            }
          />

          <section key={active} className="app-split-detail" aria-label={section.name}>
            {active === 'mono' ? (
              <>
                <SettingsHero
                  section={section}
                  kicker="Оплата онлайн"
                />
                <SettingsCard title="Підключення">
                  <Stack gap="md">
                    <Switch label="Приймати оплату через monobank" checked={monoEnabled} disabled={!!busy || clearMono} onChange={(e) => setMonoEnabled(e.currentTarget.checked)} />
                    <TextInput
                      label="Токен (X-Token)"
                      type="password"
                      autoComplete="new-password"
                      value={monoToken}
                      disabled={!!busy || clearMono}
                      placeholder={monoHasKey ? 'Новий токен для заміни збереженого' : 'Вставте токен monobank'}
                      description={monoHasKey ? 'Токен збережено. Залиште поле порожнім, щоб використати його.' : 'Зберігається зашифрованим і не показується після збереження.'}
                      onChange={(e) => setMonoToken(e.currentTarget.value.trim())}
                    />
                    <div>
                      <Button variant="default" loading={busy === 'check-mono'} disabled={!!busy || clearMono || (!monoToken && !monoHasKey)} onClick={() => void run('check-mono')}>
                        Перевірити токен
                      </Button>
                    </div>
                    <Verified at={initial.mono.verifiedAt} />
                    {initial.mono.hasToken ? (
                      <Checkbox
                        label="Видалити збережений токен"
                        checked={clearMono}
                        disabled={!!busy}
                        onChange={(e) => {
                          const checked = e.currentTarget.checked
                          setClearMono(checked)
                          if (checked) {
                            setMonoEnabled(false)
                            setMonoToken('')
                          }
                        }}
                      />
                    ) : null}
                  </Stack>
                </SettingsCard>
                <SettingsCard title="Звірка">
                  <dl className="app-split-fields">
                    <ReconcileField value={value} />
                  </dl>
                  <p className="settings-note">
                    Звірка у фоні перевіряє статуси оплат у банку. Її стан і запуск — у розділі <Link to="/system/integrations">Система → Інтеграції</Link>.
                  </p>
                </SettingsCard>
              </>
            ) : null}

            {active === 'liqpay' ? (
              <>
                <SettingsHero
                  section={section}
                  kicker="Оплата онлайн"
                />
                <SettingsCard title="Підключення">
                  <Stack gap="md">
                    <Switch
                      label="Приймати оплату через ПриватБанк (LiqPay)"
                      checked={liqPayEnabled}
                      disabled={!!busy || clearLiqPay}
                      onChange={(e) => setLiqPayEnabled(e.currentTarget.checked)}
                    />
                    <TextInput
                      label="Публічний ключ (public_key)"
                      autoComplete="off"
                      value={publicKey}
                      disabled={!!busy || clearLiqPay}
                      placeholder={initial.liqPay.publicKey && !clearLiqPay ? initial.liqPay.publicKey : 'i00000000000'}
                      description={initial.liqPay.publicKey && !clearLiqPay ? 'Залиште порожнім, щоб лишити збережений.' : undefined}
                      onChange={(e) => setPublicKey(e.currentTarget.value.trim())}
                    />
                    <TextInput
                      label="Приватний ключ (private_key)"
                      type="password"
                      autoComplete="new-password"
                      value={privateKey}
                      disabled={!!busy || clearLiqPay}
                      placeholder={initial.liqPay.hasPrivateKey && !clearLiqPay ? 'Новий ключ для заміни збереженого' : 'Вставте приватний ключ'}
                      description="Зберігається зашифрованим і не показується після збереження."
                      onChange={(e) => setPrivateKey(e.currentTarget.value.trim())}
                    />
                    <div>
                      <Button
                        variant="default"
                        loading={busy === 'check-liqpay'}
                        disabled={!!busy || clearLiqPay || (!(publicKey || initial.liqPay.publicKey) || !(privateKey || initial.liqPay.hasPrivateKey))}
                        onClick={() => void run('check-liqpay')}
                      >
                        Перевірити ключі
                      </Button>
                    </div>
                    <Verified at={initial.liqPay.verifiedAt} />
                    {initial.liqPay.publicKey || initial.liqPay.hasPrivateKey ? (
                      <Checkbox
                        label="Видалити збережені ключі"
                        checked={clearLiqPay}
                        disabled={!!busy}
                        onChange={(e) => {
                          const checked = e.currentTarget.checked
                          setClearLiqPay(checked)
                          if (checked) {
                            setLiqPayEnabled(false)
                            setPublicKey('')
                            setPrivateKey('')
                          }
                        }}
                      />
                    ) : null}
                  </Stack>
                </SettingsCard>
              </>
            ) : null}

            {active === 'wallets' ? (
              <>
                <SettingsHero
                  section={section}
                  kicker="Оплата онлайн"
                />
                <SettingsCard title="Швидка оплата з телефона">
                  <Stack gap="md">
                    <Switch label="Показувати Apple Pay / Google Pay окремим способом" checked={walletsEnabled} disabled={!!busy} onChange={(e) => setWalletsEnabled(e.currentTarget.checked)} />
                    <div>
                      <p className="settings-muted">Через який банк</p>
                      <SegmentedControl
                        value={walletsProvider}
                        disabled={!!busy}
                        onChange={setWalletsProvider}
                        data={[
                          { value: 'mono', label: 'monobank' },
                          { value: 'liqpay', label: 'ПриватБанк' },
                        ]}
                      />
                    </div>
                    {walletsEnabled && !walletBankOn ? <Alert color="yellow">Увімкніть цей банк у його розділі, інакше пункт не з’явиться в магазині.</Alert> : null}
                    <p className="settings-note">
                      Apple Pay і Google Pay мають бути ввімкнені в кабінеті банку. Перевірте на телефоні тестовою оплатою після збереження.
                    </p>
                  </Stack>
                </SettingsCard>
              </>
            ) : null}

            {active === 'fiscal' ? (
              <>
                <SettingsHero
                  section={section}
                  kicker="Чеки"
                />
                <SettingsCard title="Підключення каси">
                  <Stack gap="md">
                    <Switch
                      label="Видавати фіскальні чеки через Checkbox"
                      checked={cashEnabled}
                      disabled={!!busy || clearCash}
                      onChange={(e) => setCashEnabled(e.currentTarget.checked)}
                    />
                    {fiscal.stubAvailable && !cashEnabled ? (
                      <p className="settings-muted">На цьому сервері, доки касу вимкнено, працює тестова заглушка: чеки з номером TEST-…</p>
                    ) : null}
                    <TextInput
                      label="Ключ ліцензії каси"
                      type="password"
                      autoComplete="new-password"
                      value={license}
                      disabled={!!busy || clearCash}
                      placeholder={fiscal.hasLicenseKey && !clearCash ? 'Новий ключ для заміни збереженого' : 'Кабінет Checkbox → Каси → ключ ліцензії'}
                      onChange={(e) => setLicense(e.currentTarget.value.trim())}
                    />
                    <TextInput
                      label="Логін касира"
                      autoComplete="off"
                      value={cashierLogin}
                      disabled={!!busy || clearCash}
                      placeholder={fiscal.cashierLogin && !clearCash ? fiscal.cashierLogin : 'Логін касира в Checkbox'}
                      description={fiscal.cashierLogin && !clearCash ? 'Залиште порожнім, щоб лишити збережений.' : undefined}
                      onChange={(e) => setCashierLogin(e.currentTarget.value.trim())}
                    />
                    <TextInput
                      label="Пароль касира"
                      type="password"
                      autoComplete="new-password"
                      value={cashierPassword}
                      disabled={!!busy || clearCash}
                      placeholder={fiscal.hasPassword && !clearCash ? 'Новий пароль для заміни збереженого' : 'Пароль касира'}
                      description="Ключ ліцензії й пароль зберігаються зашифрованими й не показуються після збереження."
                      onChange={(e) => setCashierPassword(e.currentTarget.value)}
                    />
                    <div>
                      <Button
                        variant="default"
                        loading={busy === 'check-cash'}
                        disabled={!!busy || clearCash || !(license || fiscal.hasLicenseKey) || !(cashierLogin || fiscal.cashierLogin) || !(cashierPassword || fiscal.hasPassword)}
                        onClick={() => void run('check-cash')}
                      >
                        Перевірити касу
                      </Button>
                    </div>
                    <p className="settings-muted">
                      {fiscal.verifiedAt ? `Checkbox прийняв ключі ${formatDateTime(fiscal.verifiedAt)}${fiscal.fiscalNumber ? `, каса ${fiscal.fiscalNumber}` : ''}.` : 'Ключі перевіряються в Checkbox під час збереження.'}
                    </p>
                    {fiscal.hasLicenseKey || fiscal.hasPassword ? (
                      <Checkbox
                        label="Видалити збережені ключі каси"
                        checked={clearCash}
                        disabled={!!busy}
                        onChange={(e) => {
                          const checked = e.currentTarget.checked
                          setClearCash(checked)
                          if (checked) {
                            setCashEnabled(false)
                            setLicense('')
                            setCashierPassword('')
                          }
                        }}
                      />
                    ) : null}
                  </Stack>
                </SettingsCard>
              </>
            ) : null}

            {active === 'moments' ? (
              <>
                <SettingsHero section={section} kicker="Чеки" />
                <SettingsCard title="Способи оплати">
                  <Stack gap="md">
                    {PAYMENT_METHODS.map((method) => (
                      <Select
                        key={method.key}
                        label={method.label}
                        description={method.hint}
                        allowDeselect={false}
                        disabled={!!busy}
                        value={moments[method.key]}
                        data={method.key === 'card' ? MOMENT_OPTIONS : MOMENT_OPTIONS.filter((option) => option.value !== 'payment')}
                        onChange={(next) => next && setMoments((current) => ({ ...current, [method.key]: next }))}
                      />
                    ))}
                    {fiscal.provider === 'Disabled' && !cashEnabled ? <Alert color="yellow">Каса вимкнена, тож чеки зараз не видаються взагалі.</Alert> : null}
                  </Stack>
                </SettingsCard>
              </>
            ) : null}
          </section>
        </form>
      </ListPageBody>
    </ListPage>
  )
}

function bankChip(enabled: boolean, hasKey: boolean, typed: boolean): ReactNode {
  if (typed) return <TableChip dot tone="warning" value="Не збережено" />
  if (enabled && hasKey) return <TableChip dot tone="success" value="Увімкнено" />
  if (enabled) return <TableChip dot tone="warning" value="Немає ключа" />
  return <TableChip dot tone="neutral" value={hasKey ? 'Вимкнено' : 'Не підключено'} />
}

function Verified({ at }: { at: string | null }) {
  return <p className="settings-muted">{at ? `Банк прийняв ключі ${formatDateTime(at)}.` : 'Ключі перевіряються в банку під час збереження.'}</p>
}

function ReconcileField({ value }: { value: PaymentSettings }) {
  return (
    <div>
      <dt>Остання звірка оплат</dt>
      <dd>{value.lastReconcileAt ? formatDateTime(value.lastReconcileAt) : <span className="app-split-value-empty">ще не було</span>}</dd>
    </div>
  )
}

function commonSections(value: PaymentSettings): SettingsSection<PaymentSectionKey>[] {
  const fiscalMode = modeChip(value.fiscalMode)
  const automatic = PAYMENT_METHODS.filter((method) => receiptMomentTone(value.issueOn?.[method.key]) === 'success').length
  return [
    { key: 'fiscal', name: 'Фіскальні чеки', hint: providerLabel(value.fiscalProvider), icon: IconReceipt, state: <TableChip dot tone={fiscalMode.tone} value={fiscalMode.label} /> },
    {
      key: 'moments',
      name: 'Коли видається чек',
      hint: 'Для кожного способу оплати',
      icon: IconClockHour4,
      state: automatic ? <TableChip dot tone="success" value={`Автоматично: ${automatic} з ${PAYMENT_METHODS.length}`} /> : <TableChip dot tone="neutral" value="Не видається" />,
    },
  ]
}

function CommonDetail({ active, section, value }: { active: PaymentSectionKey; section: SettingsSection<PaymentSectionKey>; value: PaymentSettings }) {
  const fiscalMode = modeChip(value.fiscalMode)
  if (active === 'fiscal') {
    return (
      <>
        <SettingsHero section={section} kicker="Оплата й чеки" />
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
    )
  }

  return (
    <>
      <SettingsHero section={section} kicker="Оплата й чеки" />
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
  )
}
