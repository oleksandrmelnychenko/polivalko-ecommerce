import { useState, type KeyboardEvent } from 'react'
import { formatPrice, plural } from '@polivalko/shared/lib/format'
import { useElementClientWidth } from '@/shared/ui/data-table/useElementClientWidth'
import type { DashboardDay } from '../api/dashboardApi'
import { asDate, barPath, compact, longDate, niceMax, shortDate, type Metric } from '../lib/insights'

const HEIGHT = 260
const PAD = { top: 28, right: 8, bottom: 30, left: 56 }

export function RevenueChart({ days, metric }: { days: DashboardDay[]; metric: Metric }) {
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const width = useElementClientWidth(box)
  const [active, setActive] = useState<number | null>(null)

  const value = (d: DashboardDay) => (metric === 'revenue' ? Number(d.revenue.value) : d.orders)
  const values = days.map(value)
  const peak = Math.max(...values, 0)
  const top = niceMax(peak)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top)

  const plotW = Math.max(width - PAD.left - PAD.right, 0)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const band = days.length ? plotW / days.length : 0
  const barW = Math.max(Math.min(24, band - 2, band * 0.72), 1.5)
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH
  const labelEvery = Math.ceil(days.length / Math.max(Math.floor(plotW / 64), 1))
  const peakIndex = peak > 0 ? values.lastIndexOf(peak) : -1
  const format = (v: number) => (metric === 'revenue' ? formatPrice(v) : v.toLocaleString('uk-UA'))
  const tick = (v: number) => (metric === 'revenue' ? (v === 0 ? '0' : compact.format(v)) : Number.isInteger(v) ? String(v) : '')

  function onKey(event: KeyboardEvent) {
    if (!days.length) return
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActive(event.key === 'Home' ? 0 : days.length - 1)
    } else if (step) {
      event.preventDefault()
      setActive((a) => Math.min(Math.max((a ?? days.length - 1) + step, 0), days.length - 1))
    }
  }

  const current = active !== null ? days[active] : null
  const total = values.reduce((s, v) => s + v, 0)

  return (
    <div className="dash-chart" ref={setBox}>
      {width > 0 ? (
        <svg
          width={width}
          height={HEIGHT}
          role="group"
          tabIndex={0}
          aria-label={`${metric === 'revenue' ? 'Виручка' : 'Замовлення'} по днях, разом ${format(total)}. Стрілки ліворуч і праворуч перемикають дні.`}
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? days.length - 1)}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
        >
          <g className="dash-chart-grid dash-chart-axis">
            {ticks.map((t) => (
              <g key={t}>
                {t > 0 ? <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} /> : null}
                <text x={PAD.left - 10} y={y(t)} dy="0.32em" textAnchor="end">
                  {tick(t)}
                </text>
              </g>
            ))}
          </g>
          <line className="dash-chart-base" x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} />
          {days.map((d, i) => {
            const v = values[i]
            const x = PAD.left + i * band + (band - barW) / 2
            const h = Math.max(y(0) - y(v), v > 0 ? 2 : 0)
            return (
              <g key={d.date} className={`dash-chart-col${active === i ? ' is-active' : ''}`} onPointerEnter={() => setActive(i)}>
                <rect className="dash-chart-hit" x={PAD.left + i * band} y={PAD.top} width={band} height={plotH} />
                {h > 0 ? <path className="dash-chart-bar" d={barPath(x, y(0) - h, barW, h)} /> : null}
              </g>
            )
          })}
          {peakIndex >= 0 && active === null ? (
            <text className="dash-chart-label" x={PAD.left + peakIndex * band + band / 2} y={y(peak) - 8} textAnchor={peakIndex > days.length - 3 ? 'end' : 'middle'}>
              {format(peak)}
            </text>
          ) : null}
          <g className="dash-chart-axis">
            {days.map((d, i) =>
              (days.length - 1 - i) % labelEvery === 0 ? (
                <text key={d.date} x={PAD.left + i * band + band / 2} y={HEIGHT - 8} textAnchor={i === days.length - 1 ? 'end' : 'middle'}>
                  {i === days.length - 1 ? 'сьогодні' : shortDate.format(asDate(d.date))}
                </text>
              ) : null,
            )}
          </g>
        </svg>
      ) : null}
      {current && active !== null ? (
        <div
          className="dash-chart-tip"
          style={{ left: Math.min(Math.max(PAD.left + active * band + band / 2, 90), width - 90), top: y(values[active]) }}
          aria-live="polite"
        >
          <span>{longDate.format(asDate(current.date))}</span>
          <b>{formatPrice(current.revenue.value)}</b>
          <span>
            {current.orders} {plural(current.orders, 'замовлення', 'замовлення', 'замовлень')}
          </span>
        </div>
      ) : null}
      {peak === 0 ? <p className="dash-chart-empty">За цей період замовлень немає.</p> : null}
      <details className="dash-chart-table">
        <summary>Таблиця по днях</summary>
        <div className="dash-chart-table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">День</th>
                <th scope="col" className="is-num">
                  Замовлень
                </th>
                <th scope="col" className="is-num">
                  Виручка
                </th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.date}>
                  <td>{longDate.format(asDate(d.date))}</td>
                  <td className="is-num">{d.orders}</td>
                  <td className="is-num">{formatPrice(d.revenue.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
