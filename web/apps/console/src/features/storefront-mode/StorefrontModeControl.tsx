import { Alert, Button, Group, Radio, Stack, Text, TextInput } from '@mantine/core'
import { IconBuildingStore, IconChevronDown } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import type { components } from '@polivalko/shared/api/schema'
import { formatMoney } from '@polivalko/shared/lib/format'
import { thumb } from '@polivalko/shared/lib/images'
import { api } from '@/shared/api/client'
import { withCsrf } from '@/shared/api/csrf'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { PageState } from '@/shared/ui/PageState'
import { notifySuccess } from '@/shared/ui/notify'
import './storefront-mode.css'

const endpoint = '/api/v1/console/catalog/storefront-mode'
const modes = [
  { value: 'seasonal', title: 'Сезон', description: 'Сезонні категорії й попит у цей період минулих років.' },
  { value: 'trending', title: 'Попит зараз', description: 'За останні 7 днів товар купували частіше, ніж у середньому за тиждень протягом попередніх 21 дня.' },
  { value: 'stock_cover', title: 'Рух запасів', description: 'Запас від восьми тижнів продажів, з пріоритетом сезонних товарів.' },
] as const
type Setting = components['schemas']['StorefrontModeDto']
const titleOf = (mode: string) => modes.find(item => item.value === mode)?.title ?? 'Вітрина'
const dateLabel = (date: string) => new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'))
const kyivDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export function StorefrontModeControl() {
  const state = useApiQuery('storefront-mode', () => api.GET(endpoint, { cache: 'no-store' }))
  const [opened, setOpened] = useState(false)
  const { reload } = state
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') reload() }
    const timer = window.setInterval(refresh, 30_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [reload])
  const current = state.data
  const label = current ? 'Вітрина · ' + titleOf(current.mode) : 'Вітрина'
  const until = current?.through ? ' до ' + dateLabel(current.through) + ' включно' : ''
  return <>
    <button type="button" aria-haspopup="dialog" aria-label={label + until} title={label + until}
      className="storefront-mode-trigger" onClick={() => { setOpened(true); reload() }}>
      <IconBuildingStore size={17} aria-hidden="true" /><span>{label}</span><IconChevronDown size={13} aria-hidden="true" />
    </button>
    {opened && (current ? <ModeEditor initial={current} onClose={() => setOpened(false)}
      onSaved={next => { state.setData(next); reload(); setOpened(false) }} /> :
      <AppEditorModal opened title="Режим вітрини" onClose={() => setOpened(false)}>
        <PageState kind={state.status === 'ready' ? 'error' : state.status} onRetry={reload} />
      </AppEditorModal>)}
  </>
}

function ModeEditor({ initial, onClose, onSaved }: { initial: Setting; onClose: () => void; onSaved: (value: Setting) => void }) {
  const [baseline, setBaseline] = useState(initial)
  const [mode, setMode] = useState(initial.mode)
  const [through, setThrough] = useState(initial.through ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const preview = useApiQuery('storefront-preview:' + mode, () =>
    api.GET('/api/v1/console/catalog/storefront-mode/preview', { params: { query: { mode } }, cache: 'no-store' }))
  const end = mode === 'seasonal' || !through ? null : through
  const invalid = Boolean(end && end < kyivDate())
  const dirty = mode !== baseline.mode || end !== (baseline.through ?? null)
  async function save() {
    setBusy(true)
    setError('')
    try {
      const result = await withCsrf(headers => api.PUT(endpoint, {
        headers, body: { mode, through: end, expectedRevision: baseline.revision },
      }))
      if (result.response.status === 409) {
        const { data } = await api.GET(endpoint, { cache: 'no-store' })
        if (data) setBaseline(data)
        setError('Режим уже змінив інший працівник. Перевірте поточний режим і свій вибір.')
      } else if (result.data) {
        notifySuccess('Застосовано режим «' + titleOf(result.data.mode) + '».')
        onSaved(result.data)
      } else setError('Не вдалося застосувати режим. Перевірте дату й спробуйте ще раз.')
    } catch { setError('Немає зв’язку з магазином. Спробуйте ще раз.') }
    finally { setBusy(false) }
  }
  return <AppEditorModal opened size="standard" title="Режим вітрини" onClose={() => { if (!busy) onClose() }}
    footer={<Group justify="flex-end"><Button variant="default" disabled={busy} onClick={onClose}>Закрити</Button>
      <Button loading={busy} disabled={!dirty || invalid || preview.status !== 'ready'} onClick={() => void save()}>Застосувати</Button></Group>}>
    <Stack gap="md">
      <Text size="sm">Зараз діє <strong>{titleOf(baseline.mode)}</strong>{baseline.through && ' до ' + dateLabel(baseline.through) + ' включно'}.</Text>
      <Radio.Group label="Порядок товарів" value={mode} onChange={setMode}>
        <div className="storefront-mode-options">{modes.map(option =>
          <Radio key={option.value} disabled={busy} value={option.value} label={option.title} description={option.description} />)}</div>
      </Radio.Group>
      {mode !== 'seasonal' && <TextInput type="date" label="Діє до кінця дня за Києвом" description="Без дати режим діятиме до ручної зміни."
        value={through} min={kyivDate()} disabled={busy} onChange={event => setThrough(event.currentTarget.value)}
        error={invalid ? 'Оберіть сьогоднішню або майбутню дату.' : undefined} maw={360} />}
      <section aria-label="Попередній перегляд каталогу">
        <Text fw={600} mb="xs">Перші 12 товарів у каталозі</Text>
        {preview.status !== 'ready' ? <PageState kind={preview.status} onRetry={preview.reload} /> :
          preview.data?.length ? <ol className="storefront-mode-products">{preview.data.map((product, index) => <li key={product.id}>
            <span className="storefront-mode-rank" aria-hidden="true">{index + 1}</span>
            {product.imageUrl && <img src={thumb(product.imageUrl, 120)} alt="" width={36} height={36} />}
            <div><strong>{product.name}</strong><small>{product.sku} · {formatMoney(product.price)}{!product.inStock && ' · Немає в наявності'}</small></div>
          </li>)}</ol> : <Text size="sm">Опублікованих товарів поки немає.</Text>}
      </section>
      {error && <Alert color="red" role="alert">{error}</Alert>}
    </Stack>
  </AppEditorModal>
}
