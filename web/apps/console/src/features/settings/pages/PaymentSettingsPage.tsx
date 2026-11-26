import { Alert, Button, Checkbox, SegmentedControl, Stack, Switch, TextInput } from '@mantine/core'
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
import { checkPaymentGateway, getPaymentGateways, getPaymentSettings, savePaymentGateways, type PaymentGateways, type PaymentSettings } from '../api/settingsApi'
import { SettingsCard, SettingsHero, SettingsSectionList, useSettingsSection, type SettingsSection } from '../components/SettingsSplit'
import { modeChip, PAYMENT_METHODS, providerLabel, receiptMomentLabel, receiptMomentTone } from '../lib/paymentLabels'
import './settings.css'

type PaymentSectionKey = 'mono' | 'liqpay' | 'wallets' | 'card' | 'fiscal' | 'moments'

const EDIT_KEYS: readonly PaymentSectionKey[] = ['mono', 'liqpay', 'wallets', 'fiscal', 'moments']
const VIEW_KEYS: readonly PaymentSectionKey[] = ['card', 'fiscal', 'moments']

const FORM_ID = 'settings-payments-form'

export function PaymentSettingsPage() {
  const payments = useApiQuery('settings-payments', () => getPaymentSettings())
  const gateways = useApiQuery('settings-payment-gateways', () => getPaymentGateways())
  const editable = gateways.status === 'ready' && gateways.data
  const settled = payments.data && (gateways.status === 'ready' || gateways.status === 'forbidden' || gateways.status === 'error')

  function reload() {
    payments.reload()
    gateways.reload()
  }

  if (settled && editable) {
    return (
      <GatewaysForm
        key={gateways.data!.revision ?? 'environment'}
        value={payments.data!}
        initial={gateways.data!}
        onSaved={(saved) => {
          gateways.setData(saved)
          payments.reload()
        }}
        onReload={reload}
        busyReload={payments.isFetching || gateways.isFetching}
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
          top={<p className="settings-list-note">Банки й ключі змінює працівник із правом «Оплата: банки й ключі».</p>}
        />
        <section key={active} className="app-split-detail" aria-label={section.name}>
          {active === 'card' ? (
            <>
              <SettingsHero section={section} kicker="Оплата й чеки" description="Як магазин приймає оплату на сайті." />
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
  onSaved,
  onReload,
  busyReload,
}: {
  value: PaymentSettings
  initial: PaymentGateways
  onSaved: (value: PaymentGateways) => void
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
  const [busy, setBusy] = useState<'check-mono' | 'check-liqpay' | 'save' | null>(null)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const guard = useRef(false)

  const monoHasKey = initial.mono.hasToken && !clearMono
  const liqPayHasKeys = !!initial.liqPay.publicKey && initial.liqPay.hasPrivateKey && !clearLiqPay
  const walletBankOn = walletsProvider === 'liqpay' ? liqPayEnabled : monoEnabled

  async function run(action: 'check-mono' | 'check-liqpay' | 'save') {
    if (guard.current) return
    guard.current = true
    setBusy(action)
    setMessage(null)
    try {
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
    ...commonSections(value),
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
                  description="Покупець платить на сторінці Plata by mono: картка будь-якого банку, Apple Pay і Google Pay. Токен беруть у кабінеті web.monobank.ua → Налаштування → Інтернет-еквайринг (або на api.monobank.ua для тестового)."
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
                  description="Покупець платить на сторінці LiqPay ПриватБанку: картка, Приват24, Apple Pay і Google Pay. Ключі — у кабінеті liqpay.ua → Налаштування → API. Ключі з префіксом sandbox_ дають тестові оплати без списання грошей."
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
                  description="Окремий пункт «Apple Pay / Google Pay» у виборі оплати. Покупець потрапляє на сторінку обраного банку, де кнопки Apple Pay і Google Pay показуються на iPhone, Mac із Safari та Android."
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

            {active === 'fiscal' || active === 'moments' ? <CommonDetail active={active} section={section} value={value} /> : null}
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
        <SettingsHero section={section} kicker="Оплата й чеки" description="Як магазин видає фіскальні чеки через програмну касу. Касу налаштовує розробник у конфігурації сервера." />
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
  )
}
