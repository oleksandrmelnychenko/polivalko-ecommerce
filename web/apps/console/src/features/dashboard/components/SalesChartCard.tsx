import { SegmentedControl } from '@mantine/core'
import type { Dashboard } from '../api/dashboardApi'
import type { Metric } from '../lib/insights'
import { DashboardCard } from './DashboardCard'
import { RevenueChart } from './RevenueChart'

const METRICS = [
  { value: 'revenue', label: 'Виручка' },
  { value: 'orders', label: 'Замовлення' },
]

export function SalesChartCard({ data, metric, onMetric }: { data: Dashboard; metric: Metric; onMetric: (metric: Metric) => void }) {
  return (
    <DashboardCard
      className="dash-chart-card"
      title={metric === 'revenue' ? 'Виручка по днях' : 'Замовлення по днях'}
      aside={<SegmentedControl size="xs" aria-label="Показник графіка" data={METRICS} value={metric} onChange={(value) => onMetric(value as Metric)} />}
    >
      <RevenueChart days={data.byDay} metric={metric} />
    </DashboardCard>
  )
}
