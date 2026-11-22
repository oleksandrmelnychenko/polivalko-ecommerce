import { ActionIcon, Alert, Button, Group, Radio, Stack, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconArrowDown, IconArrowUp, IconBuildingStore, IconChevronDown, IconPackage, IconPlus, IconSearch, IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import type { components } from '@polivalko/shared/api/schema'
import { formatMoney } from '@polivalko/shared/lib/format'
import { thumb } from '@polivalko/shared/lib/images'
import { api } from '@/shared/api/client'
import { withCsrf } from '@/shared/api/csrf'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { TableChip } from '@/shared/ui/TableChip'
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
type Product = components['schemas']['ProductListItemDto']
const maxPins = 12
function ProductInfo({ product }: { product: Product }) {
  return <>
    <span className="storefront-product-image">{product.imageUrl
      ? <img src={thumb(product.imageUrl, 120)} alt="" width={36} height={36} />
      : <IconPackage size={18} aria-hidden="true" />}</span>
    <span className="storefront-product-info"><strong>{product.name}</strong><small>{product.sku} · {formatMoney(product.price)}
      {!product.inStock && ' · Немає в наявності'}</small></span>
  </>
}
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
  const [pins, setPins] = useState<string[]>(initial.pinnedProductIds ?? [])
  const [search, setSearch] = useState('')
  const [term] = useDebouncedValue(search.trim(), 250)
  const results = useApiQuery('storefront-search:' + term, () => api.GET('/api/v1/products',
    { params: { query: { q: term, sort: 'seasonal', pageSize: 8 } } }), { enabled: Boolean(term) })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const preview = useApiQuery('storefront-preview:' + mode + ':' + pins.join(','), () =>
    api.GET('/api/v1/console/catalog/storefront-mode/preview', { params: { query: { mode, pinned: pins } }, cache: 'no-store' }))
  const end = mode === 'seasonal' || !through ? null : through
  const invalid = Boolean(end && end < kyivDate())
  const dirty = mode !== baseline.mode || end !== (baseline.through ?? null) || pins.join() !== (baseline.pinnedProductIds ?? []).join()
  const missing = preview.status === 'ready' ? pins.filter(id => !preview.data?.some(product => product.id === id)) : []
  function movePin(index: number, offset: number) {
    const next = pins.slice()
    next.splice(index + offset, 0, ...next.splice(index, 1))
    setPins(next)
  }
  async function save() {
    setBusy(true)
    setError('')
    try {
      const result = await withCsrf(headers => api.PUT(endpoint, {
        headers, body: { mode, through: end, expectedRevision: baseline.revision, pinnedProductIds: pins },
      }))
      if (result.response.status === 409) {
        const { data } = await api.GET(endpoint, { cache: 'no-store' })
        if (data) {
          setBaseline(data); setMode(data.mode); setThrough(data.through ?? ''); setPins(data.pinnedProductIds ?? [])
        }
        setError('Вітрину змінив інший працівник. Перевірте оновлений порядок товарів.')
      } else if (result.data) {
        notifySuccess('Застосовано режим «' + titleOf(result.data.mode) + '».')
        onSaved(result.data)
      } else { setError('Не вдалося зберегти вітрину. Перевірте дату та доступність обраних товарів.'); preview.reload() }
    } catch { setError('Немає зв’язку з магазином. Спробуйте ще раз.') }
    finally { setBusy(false) }
  }
  return <AppEditorModal opened size="standard" className="storefront-mode-modal" title={<MetricLabel icon={IconBuildingStore}>Режим вітрини</MetricLabel>} onClose={() => { if (!busy) onClose() }}
    footer={<Group justify="flex-end"><Button variant="default" disabled={busy} onClick={onClose}>Закрити</Button>
      <Button loading={busy} disabled={!dirty || invalid || missing.length > 0 || preview.status !== 'ready'} onClick={() => void save()}>Застосувати</Button></Group>}>
    <Stack gap="xs">
      <section className="storefront-mode-card"><Group justify="space-between" gap="xs"><h3 id="storefront-order-label">Порядок товарів</h3>
        <TableChip tone="success" dot value={'Зараз · ' + titleOf(baseline.mode) + (baseline.through ? ' до ' + dateLabel(baseline.through) : '')} /></Group>
      <Radio.Group aria-labelledby="storefront-order-label" value={mode} onChange={setMode}>
        <div className="storefront-mode-options">{modes.map(option =>
          <Radio key={option.value} disabled={busy} value={option.value} label={option.title} description={option.description} />)}</div>
      </Radio.Group>
      {mode !== 'seasonal' && <TextInput type="date" label="Діє до кінця дня за Києвом" description="Без дати режим діятиме до ручної зміни."
        value={through} min={kyivDate()} disabled={busy} onChange={event => setThrough(event.currentTarget.value)}
        error={invalid ? 'Оберіть сьогоднішню або майбутню дату.' : undefined} mt="sm" maw={360} />}</section>
      <section className="storefront-mode-card" aria-label="Вибір товарів">
        <Group justify="space-between" gap="xs"><h3>Закріплені товари</h3><TableChip tone="product" value={pins.length + ' із ' + maxPins} /></Group>
        <Text size="sm" c="dimmed" mb="xs">Закріплені товари показуються першими. Решту місць заповнює обраний режим.</Text>
        <TextInput aria-label="Пошук товару для вітрини" placeholder="Назва або артикул товару" radius="xl" leftSection={<IconSearch size={16} />}
          value={search} onChange={event => setSearch(event.currentTarget.value)} />
        {search.trim() && term === search.trim() && (results.status !== 'ready' ? <PageState kind={results.status} onRetry={results.reload} /> :
          results.data?.items.length ? <ul className="storefront-search-results">{results.data.items.map(product =>
            <li key={product.id}><ProductInfo product={product} />{pins.includes(product.id) ? <TableChip tone="success" value="Закріплено" />
              : <Button variant="default" radius="xl" size="compact-xs" aria-label={'Додати ' + product.name} leftSection={<IconPlus size={14} />}
                disabled={busy || pins.length >= maxPins} onClick={() => setPins([...pins, product.id])}>Додати</Button>}</li>)}</ul>
          : <Text size="sm" role="status">Товарів за цим пошуком немає.</Text>)}
      </section>
      <section className="storefront-mode-card" aria-label="Попередній перегляд каталогу">
        <h3>Перші 12 товарів у каталозі</h3>
        {missing.length > 0 && <Alert color="orange">Закріплених товарів поза каталогом · {missing.length}{' '}
          <Button variant="default" size="compact-xs" onClick={() => setPins(pins.filter(id => !missing.includes(id)))}>Зняти закріплення з недоступних</Button></Alert>}
        {preview.status !== 'ready' ? <PageState kind={preview.status} onRetry={preview.reload} /> :
          preview.data?.length ? <ol className="storefront-mode-products">{preview.data.map((product, index) => <li key={product.id}>
            <span className="storefront-mode-rank" aria-hidden="true">{index + 1}</span>
            <ProductInfo product={product} />
            {pins.includes(product.id) && <div className="storefront-pin-actions"><TableChip value="Закріплено" tone="product" />
              <ActionIcon variant="default" size="sm" aria-label={'Підняти ' + product.name} disabled={busy || pins.indexOf(product.id) === 0}
                onClick={() => movePin(pins.indexOf(product.id), -1)}><IconArrowUp size={14} /></ActionIcon>
              <ActionIcon variant="default" size="sm" aria-label={'Опустити ' + product.name} disabled={busy || pins.indexOf(product.id) === pins.length - 1}
                onClick={() => movePin(pins.indexOf(product.id), 1)}><IconArrowDown size={14} /></ActionIcon>
              <ActionIcon variant="default" size="sm" aria-label={'Відкріпити ' + product.name} disabled={busy}
                onClick={() => setPins(pins.filter(id => id !== product.id))}><IconX size={14} /></ActionIcon>
            </div>}
          </li>)}</ol> : <Text size="sm">Опублікованих товарів поки немає.</Text>}
      </section>
      {error && <Alert color="red" role="alert">{error}</Alert>}
    </Stack>
  </AppEditorModal>
}
