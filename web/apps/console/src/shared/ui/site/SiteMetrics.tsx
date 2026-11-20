import type { Icon } from '@tabler/icons-react'
import { MetricLabel, MetricTrack } from '../MetricCard'
import './site-metrics.css'

type Metric = { label: string; icon: Icon; count: number; total?: number }
const numbers = new Intl.NumberFormat('uk-UA')

export function SiteMetrics({ label, metrics }: { label: string; metrics: Metric[] }) {
  return (
    <dl className="site-metrics" aria-label={label}>
      {metrics.map(({ label, icon, count, total }) => (
        <div key={label} className="site-metric">
          <dt><MetricLabel icon={icon}>{label}</MetricLabel></dt>
          <dd>
            {numbers.format(count)}
            {total !== undefined && <small> із {numbers.format(total)}</small>}
          </dd>
          {total !== undefined && <MetricTrack value={count} max={total} />}
        </div>
      ))}
    </dl>
  )
}
