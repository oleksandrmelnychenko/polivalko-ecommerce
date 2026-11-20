import { Button, SegmentedControl } from '@mantine/core'
import { IconCalendarStats, IconChartDots, IconChartLine, IconChevronRight, IconPackages, IconWaveSine } from '@tabler/icons-react'
import { useState } from 'react'
import { cleanProductName } from '@/shared/lib/cleanProductName'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
import type { Projection, Series } from '../api/businessAnalytics'
import { ForecastDetail, formatValue } from './BusinessForecast'

type Props = {
  forecast: Projection
  kind: string
  loading: boolean
  error: boolean
  edit: boolean
  reload: () => void
  update: (changes: Record<string, string>) => void
}

const keyOf = (row: Series) => JSON.stringify([row.kind, row.org, row.store, row.category, row.product, row.unit])
const horizons = [{ value: 'sku', label: 'Товари · 4 тижні' }, { value: 'category', label: 'Категорії · 13 тижнів' }]

export function DemandForecastReport({ forecast, kind, loading, error, edit, reload, update }: Props) {
  const [picked, setPicked] = useState<Series | null>(null)
  const [opened, setOpened] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const selected = picked && (forecast.rows.find((row) => keyOf(row) === keyOf(picked)) ?? picked)
  const { coverage, total, page } = forecast
  const pages = Math.max(1, Math.ceil(total / 40))
  const orgs = new Map(forecast.options.org.map((o) => [o.value, o.label]))
  const stores = new Map(forecast.options.store.map((o) => [o.value, o.label]))

  function show(row: Series) {
    setPicked(row)
    setDirty(false)
    setOpened(true)
  }

  return (
    <div className="ba-demand" aria-busy={loading}>
      {error ? <div role="alert" className="pa-card ba-load-error">Не вдалося оновити прогноз. <Button variant="default" onClick={reload}>Повторити</Button></div> : <>
        {coverage && !loading && (
          <div className="ba-overview-metrics ba-demand-metrics">
            <div className="pa-card"><MetricLabel icon={IconChartDots}>Ряди з прогнозом</MetricLabel><strong>{formatValue(coverage.ready)} <small>з {formatValue(total)}</small></strong></div>
            <div className="pa-card"><MetricLabel icon={IconChartLine}>Регресійна модель</MetricLabel><strong>{formatValue(coverage.regression)}</strong></div>
            <div className="pa-card"><MetricLabel icon={IconWaveSine}>Модель нерегулярного попиту</MetricLabel><strong>{formatValue(coverage.intermittent)}</strong></div>
          </div>
        )}
        <section className="pa-card ba-demand-list">
          <header className="pa-card-header">
            <div><h2><MetricLabel icon={IconCalendarStats}>Попит і потреба в закупівлі</MetricLabel></h2><p>Продажі враховано до <time dateTime={forecast.asOf}>{forecast.asOf}</time></p></div>
            <SegmentedControl aria-label="Горизонт прогнозу" value={kind} onChange={(value) => update({ kind: value, product: '' })} data={horizons} />
          </header>
          {loading ? <p role="status">Оновлюємо прогноз…</p> : forecast.rows.length > 0 ? (
            <div className="ba-table ba-demand-table" role="region" aria-label="Таблиця прогнозу попиту" tabIndex={0}>
              <table>
                <thead><tr><th scope="col">{kind === 'category' ? 'Категорія' : 'Товар'}</th><th scope="col">Організація та склад</th><th scope="col">Одиниця</th><th scope="col">Прогноз</th><th scope="col">До закупівлі</th><th scope="col">Підстава</th></tr></thead>
                <tbody>{forecast.rows.map((row) => (
                  <tr key={keyOf(row)}>
                    <th scope="row"><button type="button" aria-haspopup="dialog" onClick={() => show(row)}>{cleanProductName(row.name)}<IconChevronRight size={14} aria-hidden="true" /></button></th>
                    <td>{orgs.get(row.org) ?? row.org}<small>{stores.get(row.store) ?? row.store}</small></td>
                    <td>{row.unit || 'од. товару'}</td>
                    <td>{formatValue(row.weeks.length ? row.weeks.reduce((sum, week) => sum + week.value, 0) : null)}</td>
                    <td>{formatValue(row.purchase?.order)}</td>
                    <td>{row.reason ?? row.purchase?.reason ?? 'Розраховано'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p>Немає рядів для прогнозу за цими фільтрами.</p>}
          {(pages > 1 || page > 1) && !loading && <nav className="ba-demand-pager" aria-label="Сторінки прогнозу">
            <Button variant="default" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Назад</Button>
            <span>{formatValue(page)} / {formatValue(pages)}</span>
            <Button variant="default" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>Далі</Button>
          </nav>}
        </section>
      </>}
      <AppEditorModal
        opened={opened && !error} onClose={() => { if (!busy) setOpened(false) }}
        onExitTransitionEnd={() => setPicked(null)} dirty={dirty && !busy} withCloseButton={!busy}
        closeOnEscape={!busy} closeOnClickOutside={!busy} size="standard" className="ba-demand-modal"
        title={<MetricLabel icon={IconPackages}>{selected ? cleanProductName(selected.name) : 'Прогноз попиту'}</MetricLabel>}
      >
        {selected && <div className="ba-demand-detail">
          <p className="ba-demand-context">{[orgs.get(selected.org) ?? selected.org, stores.get(selected.store) ?? selected.store, selected.unit || 'од. товару'].join(' · ')}</p>
          <ForecastDetail key={keyOf(selected)} row={selected} start={forecast.start} edit={edit} saved={reload} onDirty={setDirty} onBusy={setBusy} />
          {selected.kind === 'sku' && selected.reason && <Button variant="default" disabled={busy || dirty} onClick={() => {
            setOpened(false)
            update({ kind: 'category', category: selected.category, org: selected.org, store: selected.store, product: '', search: '' })
          }}>Переглянути прогноз категорії на цьому складі</Button>}
        </div>}
      </AppEditorModal>
    </div>
  )
}
