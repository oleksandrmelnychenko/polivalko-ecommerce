import { IconChevronDown } from '@tabler/icons-react'
import type { ReactNode } from 'react'

type OverviewProps = {
  value: string
  label: string
  period: string
  groups: [{ label: string; count: number }, { label: string; count: number }]
}

export function ProductReportOverview({ value, label, period, groups }: OverviewProps) {
  const total = groups[0].count + groups[1].count
  const share = total ? groups[0].count / total : 0
  return <div className="report-overview">
    <div className="report-lead"><strong className="report-value">{value}</strong>
      <span>{label}</span>
    </div>
    <div className="report-distribution">
      <div className="report-dot-track" data-empty={!total || undefined} aria-hidden="true">
        <i style={{ width: `${share * 100}%` }} />
      </div>
      <dl className="report-legend">{groups.map(group => <div key={group.label}>
        <dt>{group.label}</dt><dd>{group.count.toLocaleString('uk-UA')}</dd>
      </div>)}</dl>
    </div>
    <small className="report-period">{period}</small>
  </div>
}

export function ProductReportDetails({ label, children }: { label: string; children: ReactNode }) {
  return <details className="report-details">
    <summary>{label}<IconChevronDown size={16} aria-hidden="true" /></summary>
    {children}
  </details>
}
