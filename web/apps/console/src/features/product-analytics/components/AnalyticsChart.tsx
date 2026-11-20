import { useState, type KeyboardEvent } from 'react'
import { useElementClientWidth } from '@/shared/ui/data-table/useElementClientWidth'

export type ChartPoint = {
  label: string
  axisLabel: string
  value: number | null
  low?: number
  high?: number
}

type Props = {
  label: string
  points: readonly ChartPoint[]
  format: (value: number) => string
  variant: 'bars' | 'forecast'
  baseline?: number
}

const HEIGHT = 215
const PAD = { left: 52, right: 16, top: 15, bottom: 28 }
const compact = new Intl.NumberFormat('uk-UA', { notation: 'compact', maximumFractionDigits: 1 })

export function AnalyticsChart({ label, points, format, variant, baseline }: Props) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const width = useElementClientWidth(element)
  const plotWidth = Math.max(0, width - PAD.left - PAD.right)
  const bottom = HEIGHT - PAD.bottom
  const band = plotWidth / Math.max(1, points.length)
  const values = points.flatMap((point) => [point.low, point.value, point.high].filter((value): value is number => value != null))
  const dataMin = Math.min(0, ...values)
  const dataMax = Math.max(0, baseline ?? 0, ...values)
  const tickSize = tickStep(dataMax - dataMin)
  const min = Math.floor(dataMin / tickSize) * tickSize
  const max = Math.ceil(dataMax / tickSize) * tickSize || tickSize
  const span = max - min
  const x = (i: number) => PAD.left + (i + 0.5) * band
  const y = (value: number) => bottom - (value - min) * (bottom - PAD.top) / span
  const zero = y(0)
  const ticks = Array.from({ length: Math.round(span / tickSize) + 1 }, (_, i) => min + i * tickSize)
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotWidth / 54))))
  const point = active === null ? undefined : points[active]

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActive(event.key === 'Home' ? 0 : points.length - 1)
    } else if (direction) {
      event.preventDefault()
      setActive((index) => Math.max(0, Math.min(points.length - 1, (index ?? 0) + direction)))
    }
  }

  const lineCommands: string[] = []
  let connecting = false
  for (const [index, item] of points.entries()) {
    if (item.value === null) {
      connecting = false
      continue
    }
    lineCommands.push(`${connecting ? 'L' : 'M'}${x(index)},${y(item.value)}`)
    connecting = true
  }

  const upper = points.flatMap((item, i) => item.high === undefined ? [] : [`${x(i)},${y(item.high)}`])
  const lower = points.flatMap((item, i) => item.low === undefined ? [] : [`${x(i)},${y(item.low)}`])

  return (
    <div className="pa-chart" ref={setElement}>
      <div className="pa-chart-readout" aria-live="polite">
        {point ? (
          <><span>{point.label}</span><strong>{point.value === null ? 'Даних немає' : format(point.value)}</strong>
            {point.low !== undefined && point.high !== undefined ? <span>{format(point.low)} – {format(point.high)}</span> : null}</>
        ) : null}
      </div>
      {plotWidth > 0 ? (
        <svg
          width={width}
          height={HEIGHT}
          role="group"
          tabIndex={0}
          aria-label={`${label}. Стрілки ліворуч і праворуч перемикають значення.`}
          onKeyDown={onKeyDown}
          onFocus={() => setActive((index) => index ?? 0)}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
        >
          <g aria-hidden="true">
            {ticks.map((tick) => (
              <g key={tick}>
                <line className="pa-chart-grid" x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
                <text className="pa-chart-axis" x={PAD.left - 7} y={y(tick)} dy="0.32em" textAnchor="end">{compact.format(tick)}</text>
              </g>
            ))}
            {baseline !== undefined ? (
              <line className="pa-chart-reference" x1={PAD.left} x2={width - PAD.right} y1={y(baseline)} y2={y(baseline)} />
            ) : null}
            {variant === 'forecast' && upper.length > 1 && upper.length === lower.length ? (
              <polygon className="pa-chart-band" points={[...upper, ...lower.reverse()].join(' ')} />
            ) : null}
            {variant === 'forecast' ? <path className="pa-chart-line" d={lineCommands.join(' ')} /> : null}
            {points.map((item, i) => {
              const position = x(i)
              const height = item.value === null ? 0 : Math.abs(zero - y(item.value))
              const barWidth = Math.max(1, Math.min(22, band * 0.62))
              return (
                <g key={item.label}>
                  {variant === 'bars' && item.value !== null && height > 0 ? (
                    <rect className="pa-chart-bar" data-active={i === active || undefined} x={position - barWidth / 2} y={Math.min(zero, y(item.value))} width={barWidth} height={height} rx={Math.min(3, barWidth / 2)} />
                  ) : null}
                  {i === active ? (
                    <>
                      <line className="pa-chart-cursor" x1={position} x2={position} y1={PAD.top} y2={bottom} />
                      {item.value !== null && variant !== 'bars' ? <circle className="pa-chart-dot" cx={position} cy={y(item.value)} r={4} /> : null}
                    </>
                  ) : null}
                  {i % labelEvery === 0 && (i === 0 || i < points.length - labelEvery / 2) ? (
                    <text className="pa-chart-axis" x={position} y={HEIGHT - 9} textAnchor="middle">{item.axisLabel}</text>
                  ) : null}
                  <rect className="pa-chart-hit" x={position - band / 2} y={PAD.top} width={band} height={bottom - PAD.top} onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
                </g>
              )
            })}
          </g>
        </svg>
      ) : null}
      <details className="pa-chart-details">
        <summary>Значення в таблиці</summary>
        <div className="pa-table-scroll">
          <table className="pa-table">
            <thead><tr><th scope="col">Період</th><th scope="col">Значення</th>{variant === 'forecast' ? <th scope="col">Діапазон</th> : null}</tr></thead>
            <tbody>
              {points.map((item) => (
                <tr key={item.label}>
                  <td>{item.label}</td>
                  <td>{item.value === null ? '—' : format(item.value)}</td>
                  {variant === 'forecast' ? <td>{item.low === undefined || item.high === undefined ? '—' : `${format(item.low)} – ${format(item.high)}`}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

function tickStep(range: number) {
  if (range <= 0) return 1
  const target = range / 4
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const factor = [1, 2, 2.5, 5, 10].find((value) => value * magnitude >= target) ?? 10
  return factor * magnitude
}
