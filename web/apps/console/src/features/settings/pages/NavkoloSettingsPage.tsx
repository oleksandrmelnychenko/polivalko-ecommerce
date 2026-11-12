import { Alert, Button, Checkbox, Select, Stack, Switch, TextInput } from '@mantine/core'
import { IconBuildingWarehouse, IconDeviceFloppy, IconPlugConnected, IconRefresh } from '@tabler/icons-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { TableChip } from '@/shared/ui/TableChip'
import { checkNavkolo, getNavkoloSettings, saveNavkoloSettings, type NavkoloConnection, type NavkoloStatus, type NavkoloStore } from '../api/settingsApi'
import { SettingsCard, SettingsHero, SettingsSectionList, useSettingsSection, type SettingsSection } from '../components/SettingsSplit'
import './settings.css'

const FORM_ID = 'settings-navkolo-form'

type NavkoloSectionKey = 'connection' | 'store' | 'sync'

const SECTION_KEYS: readonly NavkoloSectionKey[] = ['connection', 'store', 'sync']

export function NavkoloSettingsPage() {
  const query = useApiQuery('settings-navkolo', getNavkoloSettings)
  if (query.status === 'ready' && query.data) return <ConnectionForm initial={query.data} onSaved={query.setData} />
  return (
    <>
      <PageHeader title="Навколо" />
      <PageState
        kind={query.status === 'error' || query.status === 'forbidden' ? query.status : 'loading'}
        description={problemMessage(query.problem, 'Не вдалося завантажити налаштування.')}
        onRetry={query.reload}
      />
    </>
  )
}

function ConnectionForm({ initial, onSaved }: { initial: NavkoloConnection; onSaved: (value: NavkoloConnection) => void }) {
  const [key, setKey] = useState('')
  const [enabled, setEnabled] = useState(initial.mode === 'DNTrade')
  const [clearKey, setClearKey] = useState(false)
  const [storeId, setStoreId] = useState<string | null>(initial.storeId ?? null)
  const [stores, setStores] = useState<NavkoloStore[]>(initial.storeId ? [{ id: initial.storeId, name: initial.storeName || initial.storeId }] : [])
  const [cancellationStatusId, setCancellationStatusId] = useState<string | null>(initial.cancellationStatusId == null ? null : String(initial.cancellationStatusId))
  const [statuses, setStatuses] = useState<NavkoloStatus[]>(
    initial.cancellationStatusId == null ? [] : [{ id: initial.cancellationStatusId, name: initial.cancellationStatusName || String(initial.cancellationStatusId) }],
  )
  const [busy, setBusy] = useState<'check' | 'save' | null>(null)
  const guard = useRef(false)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const [active, select] = useSettingsSection(SECTION_KEYS)

  async function run(action: 'check' | 'save') {
    if (guard.current) return
    guard.current = true
    setBusy(action)
    setMessage(null)
    try {
      if (action === 'check') {
        const result = await withCsrf((headers) => checkNavkolo(headers, { apiKey: key || null }))
        if (!result.data) {
          setMessage({ error: true, text: Object.values(fieldErrors(result.error)).join(' ') || problemMessage(result.error, 'Не вдалося перевірити підключення.') })
          return
        }
        const found = result.data.stores ?? []
        setStores(found)
        const statusList = result.data.statuses ?? []
        setStatuses(statusList)
        setCancellationStatusId((current) => (statusList.some((s) => String(s.id) === current) ? current : null))
        setStoreId((current) => (found.some((s) => s.id === current) ? current : found.length === 1 ? found[0].id : null))
        setMessage({
          error: found.length === 0,
          text: found.length
            ? `Підключення успішне. Доступно складів: ${found.length}. Оберіть склад і статус скасування, потім збережіть налаштування.`
            : 'Ключ прийнято, але доступних складів немає. Перевірте доступи в Навколо.',
        })
        if (found.length) select('store')
      } else {
        const result = await withCsrf((headers) =>
          saveNavkoloSettings(headers, {
            revision: initial.revision ?? null,
            enabled,
            apiKey: key || null,
            clearKey,
            storeId,
            cancellationStatusId: cancellationStatusId == null ? null : Number(cancellationStatusId),
          }),
        )
        if (!result.data) {
          setMessage({ error: true, text: Object.values(fieldErrors(result.error)).join(' ') || problemMessage(result.error, 'Налаштування не збережено.') })
          return
        }
        const saved = result.data
        setCancellationStatusId(saved.cancellationStatusId == null ? null : String(saved.cancellationStatusId))
        setStatuses(saved.cancellationStatusId == null ? [] : [{ id: saved.cancellationStatusId, name: saved.cancellationStatusName || String(saved.cancellationStatusId) }])
        onSaved(saved)
        setKey('')
        setClearKey(false)
        setStoreId(saved.storeId ?? null)
        setStores(saved.storeId ? [{ id: saved.storeId, name: saved.storeName || saved.storeId }] : [])
        setMessage({
          error: false,
          text: enabled ? 'Налаштування збережено. Синхронізація запуститься автоматично; стан можна переглянути в розділі «Система → Інтеграції».' : 'Налаштування збережено. Синхронізацію вимкнено.',
        })
      }
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

  const storeName = stores.find((store) => store.id === storeId)?.name ?? null
  const statusName = statuses.find((status) => String(status.id) === cancellationStatusId)?.name ?? null

  const sections: SettingsSection<NavkoloSectionKey>[] = [
    {
      key: 'connection',
      name: 'Підключення',
      hint: 'Ключ API Навколо.Торгівля',
      icon: IconPlugConnected,
      state: clearKey ? (
        <TableChip dot tone="danger" value="Ключ буде видалено" />
      ) : key ? (
        <TableChip dot tone="warning" value="Новий ключ не збережено" />
      ) : initial.hasKey ? (
        <TableChip dot tone="success" value="Ключ збережено" />
      ) : (
        <TableChip dot tone="warning" value="Ключа немає" />
      ),
    },
    {
      key: 'store',
      name: 'Склад і скасування',
      hint: storeName ? `Склад: ${storeName}` : 'Звідки беруться товари, ціни й залишки',
      icon: IconBuildingWarehouse,
      state: storeId && cancellationStatusId ? <TableChip dot tone="success" value="Вибрано" /> : <TableChip dot tone="warning" value="Не вибрано" />,
    },
    {
      key: 'sync',
      name: 'Синхронізація',
      hint: 'Каталог, ціни, залишки й замовлення',
      icon: IconRefresh,
      state: enabled ? (
        <TableChip dot tone="success" value="Увімкнено" />
      ) : initial.mode === 'Stub' ? (
        <TableChip dot tone="warning" value="Демонстраційні дані" />
      ) : (
        <TableChip dot tone="neutral" value="Вимкнено" />
      ),
    },
  ]
  const section = sections.find((item) => item.key === active) ?? sections[0]

  return (
    <ListPage>
      <PageHeader
        title="Навколо"
        actions={
          <Button type="submit" form={FORM_ID} loading={busy === 'save'} disabled={!!busy} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
            Зберегти налаштування
          </Button>
        }
      />
      <ListPageBody>
        <form id={FORM_ID} className="app-split-layout settings-form" onSubmit={submit} aria-label="Налаштування Навколо">
          <SettingsSectionList
            label="Розділи підключення Навколо"
            sections={sections}
            active={active}
            onSelect={select}
            top={message ? <Alert color={message.error ? 'red' : 'green'} role={message.error ? 'alert' : 'status'}>{message.text}</Alert> : null}
          />

          <section key={active} className="app-split-detail" aria-label={section.name}>
            {active === 'connection' ? (
              <>
                <SettingsHero
                  section={section}
                  kicker="Навколо"
                  description="Підключіть Навколо.Торгівля, щоб оновлювати каталог, ціни й залишки та передавати замовлення. Ключ можна отримати в Навколо: Опції → Інтеграції → API DNTrade."
                />
                <SettingsCard title="Ключ API">
                  <Stack gap="md">
                    <p className="settings-muted">
                      {initial.hasKey ? 'Ключ уже збережений. Залиште поле порожнім, щоб використати його.' : 'Ключ ще не додано.'}
                    </p>
                    <TextInput
                      label="Ключ API"
                      type="password"
                      autoComplete="new-password"
                      value={key}
                      disabled={!!busy || clearKey}
                      placeholder={initial.hasKey ? 'Новий ключ для заміни збереженого' : 'Вставте ключ Навколо'}
                      description="Ключ зберігається зашифрованим і не показується після збереження."
                      onChange={(e) => {
                        setKey(e.currentTarget.value.trim())
                        setStores([])
                        setStoreId(null)
                        setStatuses([])
                        setCancellationStatusId(null)
                        setMessage(null)
                      }}
                    />
                    <div>
                      <Button variant="default" loading={busy === 'check'} disabled={!!busy || clearKey || (!key && !initial.hasKey)} onClick={() => void run('check')}>
                        Перевірити підключення
                      </Button>
                    </div>
                    <p className="settings-muted">Перевірка лише читає список складів і статусів, нічого не змінює.</p>
                    {initial.hasKey ? (
                      <Checkbox
                        label="Видалити збережений ключ"
                        checked={clearKey}
                        disabled={!!busy}
                        onChange={(e) => {
                          const checked = e.currentTarget.checked
                          setClearKey(checked)
                          if (checked) {
                            setEnabled(false)
                            setKey('')
                            setStoreId(null)
                            setStores([])
                          }
                        }}
                      />
                    ) : null}
                  </Stack>
                </SettingsCard>
              </>
            ) : null}

            {active === 'store' ? (
              <>
                <SettingsHero section={section} kicker="Навколо" description="Склад і статус скасування стають доступні після перевірки підключення." />
                <SettingsCard title="Склад і статус">
                  <Stack gap="md">
                    <Select
                      label="Склад"
                      placeholder="Спочатку перевірте підключення"
                      searchable
                      value={storeId}
                      data={stores.map((s) => ({ value: s.id, label: s.name }))}
                      disabled={!!busy || !stores.length || clearKey}
                      onChange={setStoreId}
                      description="Каталог, ціни й залишки надходитимуть із вибраного складу."
                    />
                    <Select
                      label="Статус скасування в Навколо"
                      placeholder="Оберіть після перевірки підключення"
                      searchable
                      value={cancellationStatusId}
                      data={statuses.map((s) => ({ value: String(s.id), label: s.name }))}
                      disabled={!!busy || !statuses.length || clearKey}
                      onChange={setCancellationStatusId}
                      description="Цей статус буде встановлено в Навколо, коли замовлення скасують у консолі."
                    />
                    {!stores.length && !clearKey ? (
                      <Button variant="subtle" size="xs" color="gray" w="fit-content" onClick={() => select('connection')}>
                        Перейти до перевірки підключення
                      </Button>
                    ) : null}
                  </Stack>
                </SettingsCard>
                {statusName || storeName ? (
                  <SettingsCard title="Вибрано зараз">
                    <dl className="app-split-fields">
                      <div>
                        <dt>Склад</dt>
                        <dd>{storeName ?? <span className="app-split-value-empty">не вибрано</span>}</dd>
                      </div>
                      <div>
                        <dt>Статус скасування</dt>
                        <dd>{statusName ?? <span className="app-split-value-empty">не вибрано</span>}</dd>
                      </div>
                    </dl>
                  </SettingsCard>
                ) : null}
              </>
            ) : null}

            {active === 'sync' ? (
              <>
                <SettingsHero
                  section={section}
                  kicker="Навколо"
                  description={
                    initial.mode === 'Stub' ? 'Зараз працюють демонстраційні дані.' : initial.mode === 'DNTrade' ? 'Синхронізацію з Навколо ввімкнено.' : 'Синхронізацію вимкнено.'
                  }
                />
                <SettingsCard title="Синхронізація">
                  <Stack gap="md">
                    <Switch label="Увімкнути синхронізацію" checked={enabled} disabled={!!busy || clearKey} onChange={(e) => setEnabled(e.currentTarget.checked)} />
                    <p className="settings-muted">
                      Після збереження синхронізація працює без перезапуску сервера. Скасування переданого замовлення підтверджується через Навколо; до підтвердження резерв
                      зберігається. Стан синхронізації видно в розділі <Link to="/system/integrations">Система → Інтеграції</Link>.
                    </p>
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
