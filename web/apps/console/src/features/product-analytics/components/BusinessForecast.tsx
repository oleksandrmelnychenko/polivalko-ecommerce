import { useState } from 'react'
import { Button } from '@mantine/core'
import { kyivDay } from '@/shared/lib/kyivTime'
import { writeBusiness, type Series } from '../api/businessAnalytics'
import { AnalyticsChart } from './AnalyticsChart'

export const formatValue = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('uk-UA', { maximumFractionDigits: 2 })
const weeklyModelNames: Record<string, string> = {
  ridge: 'регресія за недавнім та торішнім попитом', mean4: 'середнє за 4 тижні',
  ridgeRecent: 'регресія за останнім тижнем і середнім попитом за чотири тижні',
  mean8: 'середнє за 8 тижнів', season52: 'відповідні тижні торік', intermittent: 'частота та обсяг нерегулярних продажів',
  seasonScaled: 'відповідні тижні торік із поправкою на річну зміну продажів',
}
const shift = (s: string, days: number) =>
  new Date(Date.parse(s + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10)

type PolicyEditorProps = { saved: () => void; onDirty: (dirty: boolean) => void; onBusy: (busy: boolean) => void }

function PolicyForm({ row, saved, onDirty, onBusy }: { row: Series } & PolicyEditorProps) {
  const policy = row.policy
  const [deliveries, setDeliveries] = useState(policy?.deliveries ?? [])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="ba-policy"
      onChange={() => onDirty(true)}
      onSubmit={async (e) => {
        e.preventDefault()
        const fields = new FormData(e.currentTarget)
        setBusy(true)
        onBusy(true)
        try {
          await writeBusiness('policy', {
            product: row.product,
            org: row.org,
            store: row.store,
            unit: row.unit,
            revision: policy?.revision ?? 0,
            lead: Number(fields.get('lead')),
            review: Number(fields.get('review')),
            safety: Number(fields.get('safety')),
            confirmed: kyivDay(new Date()),
            deliveries,
          })
          setMessage('Налаштування збережено')
          onDirty(false)
          saved()
        } catch (err) {
          setMessage(err instanceof Error ? err.message : 'Помилка збереження')
        } finally {
          setBusy(false)
          onBusy(false)
        }
      }}
    >
      <div className="ba-controls">
        {(
          [
            ['lead', 'Поставка, днів'],
            ['review', 'Між закупівлями, днів'],
            ['safety', 'Страховий запас, днів'],
          ] as const
        ).map(([field, label]) => (
          <label key={field}>
            {label}
            <input
              type="number"
              name={field}
              defaultValue={policy?.[field]}
              required
              min={field === 'review' ? 1 : 0}
              max={365}
            />
          </label>
        ))}
      </div>
      <strong>Підтверджені надходження</strong>
      {deliveries.map((d, i) => (
        <div className="ba-controls" key={i}>
          <label>
            Дата
            <input
              required
              type="date"
              min={kyivDay(new Date())}
              value={d.day}
              onChange={(e) => setDeliveries(deliveries.map((x, j) => (j === i ? { ...x, day: e.target.value } : x)))}
            />
          </label>
          <label>
            Кількість
            <input
              required
              type="number"
              step="any"
              min="0.001"
              value={d.qty || ''}
              onChange={(e) =>
                setDeliveries(deliveries.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))
              }
            />
          </label>
          <Button type="button" variant="subtle" onClick={() => { onDirty(true); setDeliveries(deliveries.filter((_, j) => j !== i)) }}>
            Прибрати
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="default"
        onClick={() => { onDirty(true); setDeliveries([...deliveries, { day: kyivDay(new Date()), qty: 0 }]) }}
      >
        Додати надходження
      </Button>
      <label>
        <input type="checkbox" required /> Перевірено всі надходження на сьогодні ({deliveries.length})
      </label>
      <Button type="submit" loading={busy}>
        Зберегти умови закупівлі
      </Button>
      <span role="status">{message}</span>
    </form>
  )
}

export function ForecastDetail({
  row,
  start,
  edit,
  saved,
  onDirty,
  onBusy,
}: {
  row: Series
  start: string
  edit: boolean
} & PolicyEditorProps) {
  const points = [
    ...row.history.map((value, i) => ({
      label: 'Факт · ' + shift(start, 7 * (i - row.history.length)),
      axisLabel: shift(start, 7 * (i - row.history.length)).slice(5),
      value,
    })),
    ...row.weeks.map((w, i) => ({
      label: 'Прогноз · ' + shift(start, 7 * i),
      axisLabel: shift(start, 7 * i).slice(5),
      ...w,
    })),
  ]
  return (
    <section className="ba-detail">
      {row.reason ? <p>{row.reason}</p> : (
        <dl className="ba-model-facts">
          <div><dt>Модель</dt><dd>{weeklyModelNames[row.model ?? ''] ?? row.model ?? '—'}</dd></div>
          <div><dt>Контрольних періодів</dt><dd>{formatValue(row.folds)}{row.seasonFolds ? ` і ще ${row.seasonFolds} у ті самі тижні минулих років` : ''}</dd></div>
          {row.wape != null && <div><dt>Похибка WAPE</dt><dd>{formatValue(row.wape * 100)}%</dd></div>}
          {row.bias != null && <div><dt>Зміщення</dt><dd>{formatValue(row.bias * 100)}%</dd></div>}
        </dl>
      )}
      {!row.reason && !!row.staleWeeks && <p>Останні {row.staleWeeks} тиж. товару не було на складі або бракує даних. Прогноз спирається на продажі до цієї перерви.</p>}
      {row.baselineWape != null && <p>Похибка найкращої простої моделі на тому самому контрольному періоді · {formatValue(row.baselineWape * 100)}%</p>}
      {row.wape != null && row.wape >= 1 && <p>На останній перевірці сума абсолютних помилок сягнула обсягу фактичних продажів або перевищила його. Прогноз цього ряду має низьку точність.</p>}
      <AnalyticsChart
        label={'Тижневий попит. Прогноз із ' + start}
        points={points}
        format={formatValue}
        variant="forecast"
      />
      {row.weeks.length > 0 && <p className="ba-interval-note">Межі прогнозу показують розкид помилок на історичних даних.</p>}
      {row.purchase && (
        <p>
          {[
            row.purchase.reason ?? 'До закупівлі ' + formatValue(row.purchase.order),
            row.purchase.available != null && 'Доступно ' + formatValue(row.purchase.available),
            row.purchase.incoming != null && 'Надходження ' + formatValue(row.purchase.incoming),
            row.purchase.stockout && 'Вичерпання запасу ' + row.purchase.stockout,
          ].filter(Boolean).join(' · ')}
        </p>
      )}
      {edit && row.kind === 'sku' && row.store !== 'unknown' && (
        <details>
          <summary>Умови закупівлі та надходження</summary>
          <PolicyForm key={row.policy?.revision ?? 0} row={row} saved={saved} onDirty={onDirty} onBusy={onBusy} />
        </details>
      )}
    </section>
  )
}
