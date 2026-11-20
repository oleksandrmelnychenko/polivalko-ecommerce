import { useState } from 'react'
import { Button } from '@mantine/core'
import { kyivDay } from '@/shared/lib/kyivTime'
import { writeBusiness, type Series } from '../api/businessAnalytics'
import { AnalyticsChart } from './AnalyticsChart'

export const formatValue = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('uk-UA', { maximumFractionDigits: 2 })
const shift = (s: string, days: number) =>
  new Date(Date.parse(s + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10)

function PolicyForm({ row, saved }: { row: Series; saved: () => void }) {
  const policy = row.policy
  const [deliveries, setDeliveries] = useState(policy?.deliveries ?? [])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="ba-policy"
      onSubmit={async (e) => {
        e.preventDefault()
        const fields = new FormData(e.currentTarget)
        setBusy(true)
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
          saved()
        } catch (err) {
          setMessage(err instanceof Error ? err.message : 'Помилка збереження')
        } finally {
          setBusy(false)
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
          <Button type="button" variant="subtle" onClick={() => setDeliveries(deliveries.filter((_, j) => j !== i))}>
            Прибрати
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="default"
        onClick={() => setDeliveries([...deliveries, { day: kyivDay(new Date()), qty: 0 }])}
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
}: {
  row: Series
  start: string
  edit: boolean
  saved: () => void
}) {
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
      <h3>
        {row.name} · {row.unit || 'од. товару'}
      </h3>
      <p>
        {row.reason ??
          'Модель ' +
            row.model +
            ' · контрольних періодів ' +
            row.folds +
            ' · WAPE ' +
            formatValue(row.wape == null ? null : row.wape * 100) +
            '% · зміщення ' +
            formatValue(row.bias == null ? null : row.bias * 100) +
            '%'}
      </p>
      <AnalyticsChart
        label={'Тижневий попит. Прогноз із ' + start}
        points={points}
        format={formatValue}
        variant="forecast"
      />
      {row.purchase && (
        <p>
          {row.purchase.reason ?? 'До закупівлі ' + formatValue(row.purchase.order)} · доступно{' '}
          {formatValue(row.purchase.available)} · надходження {formatValue(row.purchase.incoming)} · вичерпання запасу{' '}
          {row.purchase.stockout ?? '—'}
        </p>
      )}
      {edit && row.kind === 'sku' && row.store !== 'unknown' && (
        <details>
          <summary>Умови закупівлі та надходження</summary>
          <PolicyForm row={row} saved={saved} />
        </details>
      )}
    </section>
  )
}
