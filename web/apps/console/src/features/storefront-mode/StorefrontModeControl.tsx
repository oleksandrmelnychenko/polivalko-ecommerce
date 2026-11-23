import { ActionIcon, Alert, Button, Group, NativeSelect, SegmentedControl, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconArrowDown, IconArrowUp, IconBuildingStore, IconChevronDown, IconGripVertical, IconPackage, IconPlus, IconSearch, IconX } from '@tabler/icons-react'
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
import { seasonLabel, seasonReason, seasonTone, sourceLabel } from './seasonLabels'
import './storefront-mode.css'

const endpoint = '/api/v1/console/catalog/storefront-mode'
const modes = [
  { value: 'seasonal', title: 'Сезон', description: 'Призначення товару та попит у цей період минулих років.' },
  { value: 'trending', title: 'Попит зараз', description: 'За останні 7 днів товар купували частіше, ніж у середньому за тиждень протягом попередніх 21 дня.' },
  { value: 'stock_cover', title: 'Рух запасів', description: 'Запас від восьми тижнів продажів, з пріоритетом сезонних товарів.' },
] as const
type Setting = components['schemas']['StorefrontModeDto']
type Product = components['schemas']['ProductListItemDto']
const maxPins = 12
const count = new Intl.NumberFormat('uk-UA')
function previewRows(data: components['schemas']['StorefrontPreviewDto'] | Product[] | null | undefined, term = '') {
  if (!Array.isArray(data)) return data?.items ?? []
  const query = term.toLocaleLowerCase('uk-UA')
  return data.filter(product => !query || [product.name, product.sku].some(value => value?.toLocaleLowerCase('uk-UA').includes(query)))
    .map(product => ({ product, season: '', source: '' }))
}
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
const months = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень']

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
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const today = kyivDate()
  const [year, currentMonth] = today.split('-').map(Number)
  const month = mode === 'seasonal' ? selectedMonth ?? currentMonth : undefined
  const monthOptions = months.map((_, offset) => {
    const index = currentMonth - 1 + offset
    return { value: String(index % 12 + 1), label: months[index % 12] + ' ' + (year + Math.floor(index / 12)) + (offset === 0 ? ' · поточний' : '') }
  })
  const [through, setThrough] = useState(initial.through ?? '')
  const [pins, setPins] = useState<string[]>(initial.pinnedProductIds ?? [])
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [term] = useDebouncedValue(search.trim(), 250)
  const results = useApiQuery('storefront-search:' + term, () => api.GET('/api/v1/products',
    { params: { query: { q: term, sort: 'seasonal', pageSize: 8 } } }), { enabled: Boolean(term) })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lookup, setLookup] = useState('')
  const [found] = useDebouncedValue(lookup.trim(), 250)
  // Reordering the same pins only changes their positions, not the automatic selections.
  const preview = useApiQuery(['storefront-preview', today, mode, month, [...pins].sort().join(',')].join(':'), () =>
    api.GET('/api/v1/console/catalog/storefront-mode/preview', { params: { query: { mode, month, pinned: pins } }, cache: 'no-store' }))
  // The same order narrowed to what a name or an article finds. The catalog above stays loaded: saving depends on it.
  const lookedUp = useApiQuery(['storefront-lookup', today, mode, month, found].join(':'), () =>
    api.GET('/api/v1/console/catalog/storefront-mode/preview', { params: { query: { mode, month, q: found } }, cache: 'no-store' }),
    { enabled: Boolean(found) })
  const searching = Boolean(lookup.trim())
  const shown = searching ? lookedUp : preview
  // Saving waits for the catalog preview, so its failure is shown even while a search is open.
  const failed = preview.status === 'error' || preview.status === 'forbidden'
  // Until the typed words reach the request, the list on screen answers the previous ones.
  const listStatus = failed ? preview.status : searching && found !== lookup.trim() ? 'loading' : shown.status
  const end = mode === 'seasonal' || !through ? null : through
  const invalid = Boolean(end && end < kyivDate())
  const dirty = mode !== baseline.mode || end !== (baseline.through ?? null) || pins.join() !== (baseline.pinnedProductIds ?? []).join()
  const items = previewRows(preview.data)
  const byId = new Map(items.map(item => [item.product.id, item]))
  // The catalog starts with the pins, in the order chosen here. A search shows only what it found.
  const rows = searching ? previewRows(lookedUp.data, found)
    : [...pins.flatMap(id => byId.get(id) ?? []), ...items.filter(item => !pins.includes(item.product.id))]
  const missing = preview.status === 'ready' ? pins.filter(id => !byId.has(id)) : []
  const counts = preview.data?.counts
  const missingSections = preview.data?.missingSections ?? []
  function movePin(index: number, destination: number) {
    if (busy || index < 0 || destination < 0 || destination >= pins.length || destination === index) return
    const next = pins.slice()
    next.splice(destination, 0, ...next.splice(index, 1))
    setPins(next)
  }
  function finishDrag() {
    setDraggedId(null)
    setTargetId(null)
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
  return <AppEditorModal opened size="wide" className="storefront-mode-modal" title={<MetricLabel icon={IconBuildingStore}>Режим вітрини</MetricLabel>} onClose={() => { if (!busy) onClose() }}
    footer={<Group justify="flex-end"><Button variant="default" disabled={busy} onClick={onClose}>Закрити</Button>
      <Button loading={busy} disabled={!dirty || invalid || missing.length > 0 || preview.status !== 'ready'} onClick={() => void save()}>Застосувати</Button></Group>}>
    <div className="storefront-mode-layout">
      <section className="storefront-mode-card"><Group justify="space-between" gap="xs"><h3 id="storefront-order-label">Порядок товарів</h3>
        <TableChip tone="success" dot value={'Зараз · ' + titleOf(baseline.mode) + (baseline.through ? ' до ' + dateLabel(baseline.through) : '')} /></Group>
      <SegmentedControl className="storefront-mode-options" aria-labelledby="storefront-order-label"
        size="xs" radius="xl" color="dark" value={mode} onChange={setMode} disabled={busy}
        data={modes.map(option => ({ value: option.value, label: option.title }))} />
      <Text size="sm" c="dimmed">{modes.find(option => option.value === mode)?.description}</Text>
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
        <Group justify="space-between" gap="xs"><h3>{searching ? 'Знайдені товари' : Array.isArray(preview.data) ? 'Перші 12 товарів у каталозі' : 'Перші 48 товарів у каталозі'}</h3>
          {counts && <span className="storefront-season-counts">
            <TableChip tone={seasonTone('in_season')} value={seasonLabel('in_season') + ' · ' + count.format(counts.inSeason)} />
            <TableChip tone={seasonTone('all_year')} value={seasonLabel('all_year') + ' · ' + count.format(counts.allYear)} />
            <TableChip tone={seasonTone('off_season')} value={seasonLabel('off_season') + ' · ' + count.format(counts.offSeason)} />
          </span>}</Group>
        <div className="storefront-preview-tools">
        {mode === 'seasonal' && <NativeSelect label="Місяць перегляду" value={String(month)} data={monthOptions}
          description={month === currentMonth ? undefined : 'Прогноз на 15-те число за сьогоднішніми залишками. Місяць змінює лише попередній перегляд.'}
          onChange={event => { const value = Number(event.currentTarget.value); setSelectedMonth(value === currentMonth ? null : value) }} />}
        <TextInput label="Пошук у каталозі" aria-label="Пошук товару в перегляді" placeholder="Назва або артикул товару" radius="xl"
          leftSection={<IconSearch size={16} />} value={lookup} maxLength={128} onChange={event => setLookup(event.currentTarget.value)} />
        </div>
        {missingSections.length > 0 && <Alert color="orange" mt="xs" title={'Розділів із сезонних правил немає в каталозі · ' + missingSections.length}>
          {missingSections.join('; ')}. Розділ перейменовано або прибрано, тож його товари лишилися без сезонних правил — правила треба оновити.</Alert>}
        {missing.length > 0 && <Alert color="orange" mt="xs">Закріплених товарів поза каталогом · {missing.length}{' '}
          <Button variant="default" size="compact-xs" onClick={() => setPins(pins.filter(id => !missing.includes(id)))}>Зняти закріплення з недоступних</Button></Alert>}
        {listStatus !== 'ready' ? <PageState kind={listStatus} onRetry={failed ? preview.reload : shown.reload} /> :
          rows.length ? <ol className="storefront-mode-products">{rows.map(({ product, season, source }, index) => {
            const pinIndex = searching ? -1 : pins.indexOf(product.id)
            const canDrop = !busy && draggedId !== null && draggedId !== product.id && pinIndex >= 0
            return <li key={product.id} data-dragging={draggedId === product.id || undefined}
              data-drop-target={canDrop && targetId === product.id || undefined}
              onDragOver={event => {
                if (!canDrop) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setTargetId(product.id)
              }}
              onDragLeave={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null) && targetId === product.id) setTargetId(null)
              }}
              onDrop={event => {
                if (!canDrop) return
                event.preventDefault()
                movePin(pins.indexOf(draggedId), pinIndex)
                finishDrag()
              }}>
              <span className="storefront-mode-rank" aria-hidden="true">{searching ? '—' : index + 1}</span>
              <ProductInfo product={product} />
              {season && <span className="storefront-season"><TableChip tone={seasonTone(season)} value={seasonLabel(season)}
                title={seasonReason(season, source)} /><small>{sourceLabel(source)}</small>
                {searching && pins.includes(product.id) && <TableChip tone="product" value="Закріплено" />}</span>}
              {pinIndex >= 0 && <div className="storefront-pin-actions">
                <span className="app-table-chip is-product storefront-pin-grip" draggable={!busy && pins.length > 1}
                  title={pins.length > 1 ? 'Перетягнути на місце іншого закріпленого товару' : 'Закріплено'}
                  onDragStart={event => {
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('application/x-storefront-pin', product.id)
                    setDraggedId(product.id)
                  }} onDragEnd={finishDrag}>
                  {pins.length > 1 && <IconGripVertical size={14} aria-hidden="true" />}Закріплено
                </span>
                <ActionIcon variant="default" size="sm" aria-label={'Підняти ' + product.name} disabled={busy || pinIndex === 0}
                  onClick={() => movePin(pinIndex, pinIndex - 1)}><IconArrowUp size={14} /></ActionIcon>
                <ActionIcon variant="default" size="sm" aria-label={'Опустити ' + product.name} disabled={busy || pinIndex === pins.length - 1}
                  onClick={() => movePin(pinIndex, pinIndex + 1)}><IconArrowDown size={14} /></ActionIcon>
                <ActionIcon variant="default" size="sm" aria-label={'Відкріпити ' + product.name} disabled={busy}
                  onClick={() => setPins(pins.filter(id => id !== product.id))}><IconX size={14} /></ActionIcon>
              </div>}
            </li>
          })}</ol> : <Text size="sm" role="status">{searching ? 'Товарів за цим пошуком немає.' : 'Опублікованих товарів поки немає.'}</Text>}
      </section>
      {error && <Alert color="red" role="alert">{error}</Alert>}
    </div>
  </AppEditorModal>
}
