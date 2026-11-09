import { Alert, Button, Checkbox, Select, Stack, Switch, TextInput } from '@mantine/core'
import { useRef, useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { SectionCard } from '../components/SectionCard'
import { checkNavkolo, getNavkoloSettings, saveNavkoloSettings, type NavkoloConnection, type NavkoloStore, type NavkoloStatus } from '../api/settingsApi'
import './settings.css'

export function NavkoloSettingsPage() {
  const query = useApiQuery('settings-navkolo', getNavkoloSettings)
  if (query.status === 'ready' && query.data) return <ConnectionForm initial={query.data} onSaved={query.setData} />
  return <><PageHeader title="Навколо" /><PageState kind={query.status === 'error' || query.status === 'forbidden' ? query.status : 'loading'} description={problemMessage(query.problem, 'Не вдалося завантажити налаштування.')} onRetry={query.reload} /></>
}

function ConnectionForm({ initial, onSaved }: { initial: NavkoloConnection; onSaved: (value: NavkoloConnection) => void }) {
  const [key, setKey] = useState('')
  const [enabled, setEnabled] = useState(initial.mode === 'DNTrade')
  const [clearKey, setClearKey] = useState(false)
  const [storeId, setStoreId] = useState<string | null>(initial.storeId ?? null)
  const [stores, setStores] = useState<NavkoloStore[]>(initial.storeId ? [{ id: initial.storeId, name: initial.storeName || initial.storeId }] : [])
  const [cancellationStatusId, setCancellationStatusId] = useState<string | null>(initial.cancellationStatusId == null ? null : String(initial.cancellationStatusId))
  const [statuses, setStatuses] = useState<NavkoloStatus[]>(initial.cancellationStatusId == null ? [] : [{ id: initial.cancellationStatusId, name: initial.cancellationStatusName || String(initial.cancellationStatusId) }])
  const [busy, setBusy] = useState<'check' | 'save' | null>(null)
  const guard = useRef(false)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)

  async function run(action: 'check' | 'save') {
    if (guard.current) return
    guard.current = true; setBusy(action); setMessage(null)
    try {
      if (action === 'check') {
        const result = await withCsrf((headers) => checkNavkolo(headers, { apiKey: key || null }))
        if (!result.data) { setMessage({ error: true, text: Object.values(fieldErrors(result.error)).join(' ') || problemMessage(result.error, 'Не вдалося перевірити підключення.') }); return }
        const found = result.data.stores ?? []
        setStores(found)
        const statusList = result.data.statuses ?? []
        setStatuses(statusList)
        setCancellationStatusId((current) => statusList.some((s) => String(s.id) === current) ? current : null)
        setStoreId((current) => found.some((s) => s.id === current) ? current : found.length === 1 ? found[0].id : null)
        setMessage({ error: found.length === 0, text: found.length ? `Підключення успішне. Доступно складів: ${found.length}. Оберіть склад і статус скасування, потім збережіть налаштування.` : 'Ключ прийнято, але доступних складів немає. Перевірте доступи в Навколо.' })
      } else {
        const result = await withCsrf((headers) => saveNavkoloSettings(headers, { revision: initial.revision ?? null, enabled, apiKey: key || null, clearKey, storeId, cancellationStatusId: cancellationStatusId == null ? null : Number(cancellationStatusId) }))
        if (!result.data) { setMessage({ error: true, text: Object.values(fieldErrors(result.error)).join(' ') || problemMessage(result.error, 'Налаштування не збережено.') }); return }
        const saved = result.data
        setCancellationStatusId(saved.cancellationStatusId == null ? null : String(saved.cancellationStatusId))
        setStatuses(saved.cancellationStatusId == null ? [] : [{ id: saved.cancellationStatusId, name: saved.cancellationStatusName || String(saved.cancellationStatusId) }])
        onSaved(saved); setKey(''); setClearKey(false); setStoreId(saved.storeId ?? null)
        setStores(saved.storeId ? [{ id: saved.storeId, name: saved.storeName || saved.storeId }] : [])
        setMessage({ error: false, text: enabled ? 'Налаштування збережено. Синхронізація запуститься автоматично; стан можна переглянути в розділі «Система → Інтеграції».' : 'Налаштування збережено. Синхронізацію вимкнено.' })
      }
    } catch { setMessage({ error: true, text: 'Сервер не відповідає. Перевірте з’єднання й повторіть спробу.' }) }
    finally { guard.current = false; setBusy(null) }
  }

  function submit(event: FormEvent) { event.preventDefault(); void run('save') }
  return <div className="settings-page">
    <PageHeader title="Навколо" />
    <form className="settings-form" onSubmit={submit} aria-label="Налаштування Навколо">
      <Stack gap="lg">
        <p className="settings-lead">Підключіть Навколо.Торгівля, щоб оновлювати каталог, ціни й залишки та передавати замовлення.</p>
        {message && <Alert color={message.error ? 'red' : 'green'} role={message.error ? 'alert' : 'status'}>{message.text}</Alert>}
        <SectionCard title="Підключення" description="Ключ можна отримати в Навколо: Опції → Інтеграції → API DNTrade.">
          <Stack gap="sm">
            <p className="settings-muted">{initial.mode === 'Stub' ? 'Зараз працюють демонстраційні дані.' : initial.mode === 'DNTrade' ? 'Синхронізацію з Навколо ввімкнено.' : 'Синхронізацію вимкнено.'} {initial.hasKey ? 'Ключ уже збережений. Залиште поле порожнім, щоб використати його.' : 'Ключ ще не додано.'}</p>
            <TextInput label="Ключ API" type="password" autoComplete="new-password" value={key} disabled={!!busy || clearKey} placeholder={initial.hasKey ? 'Новий ключ для заміни збереженого' : 'Вставте ключ Навколо'} description="Ключ зберігається зашифрованим і не показується після збереження." onChange={(e) => { setKey(e.currentTarget.value.trim()); setStores([]); setStoreId(null); setStatuses([]); setCancellationStatusId(null); setMessage(null) }} />
            <div><Button variant="default" loading={busy === 'check'} disabled={!!busy || clearKey || (!key && !initial.hasKey)} onClick={() => void run('check')}>Перевірити підключення</Button></div>
            <Select label="Склад" placeholder="Спочатку перевірте підключення" searchable value={storeId} data={stores.map((s) => ({ value: s.id, label: s.name }))} disabled={!!busy || !stores.length || clearKey} onChange={setStoreId} description="Каталог, ціни й залишки надходитимуть із вибраного складу." />
            <Select label="Статус скасування в Навколо" placeholder="Оберіть після перевірки підключення" searchable value={cancellationStatusId} data={statuses.map((s) => ({ value: String(s.id), label: s.name }))} disabled={!!busy || !statuses.length || clearKey} onChange={setCancellationStatusId} description="Цей статус буде встановлено в Навколо, коли замовлення скасують у консолі." />
            <Switch label="Увімкнути синхронізацію" checked={enabled} disabled={!!busy || clearKey} onChange={(e) => setEnabled(e.currentTarget.checked)} />
            {initial.hasKey && <Checkbox label="Видалити збережений ключ" checked={clearKey} disabled={!!busy} onChange={(e) => { const checked = e.currentTarget.checked; setClearKey(checked); if (checked) { setEnabled(false); setKey(''); setStoreId(null); setStores([]) } }} />}
          </Stack>
        </SectionCard>
        <div><Button type="submit" loading={busy === 'save'} disabled={!!busy}>Зберегти налаштування</Button></div>
        <p className="settings-muted">Перевірка підключення лише читає список складів. Після збереження синхронізація працює без перезапуску сервера. Скасування переданого замовлення підтверджується через Навколо; до підтвердження резерв зберігається.</p>
      </Stack>
    </form>
  </div>
}
