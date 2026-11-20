import { IconCircleCheck } from '@tabler/icons-react'
import type { Dashboard } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'

const dots = Array.from({ length: 33 }, (_, index) => {
  const angle = Math.PI * (1 - index / 32)
  return { x: Math.cos(angle), y: Math.sin(angle) }
})
const percent = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 })

export function CompletionCard({ statuses }: { statuses: Dashboard['byStatus'] }) {
  const total = statuses.reduce((sum, item) => sum + item.count, 0)
  const completed = statuses.find((item) => item.status === 'completed')?.count ?? 0
  const ratio = total ? completed / total : 0
  const filled = Math.round(ratio * dots.length)

  return (
    <section className="dash-feature-card dash-completion">
      <h2><IconCircleCheck aria-hidden="true" />Виконані замовлення</h2>
      <div className="dash-completion-body">
        <div className="dash-dial">
        <svg viewBox="0 0 256 130" aria-hidden="true">
          {dots.map(({ x, y }, i) => (
            <g key={i} className={i < filled ? 'is-filled' : undefined}>
              <circle cx={128 + 119 * x} cy={124 - 119 * y} r="4" />
              <circle cx={128 + 105 * x} cy={124 - 105 * y} r="1.3" />
              <circle cx={128 + 101 * x} cy={124 - 101 * y} r=".8" />
            </g>
          ))}
        </svg>
        <strong>{total ? <>{percent.format(ratio * 100)}<small>%</small></> : '—'}</strong>
        </div>
        <dl className="dash-completion-counts">
          <div><dt>Усього замовлень</dt><dd>{numberFormat.format(total)}</dd></div>
          <div><dt>Виконано</dt><dd>{numberFormat.format(completed)}</dd></div>
        </dl>
      </div>
      {!total && <p>За цей період замовлень немає.</p>}
    </section>
  )
}
