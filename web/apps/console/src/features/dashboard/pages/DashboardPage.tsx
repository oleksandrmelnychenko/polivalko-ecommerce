import { ActionIcon, SegmentedControl, Skeleton, Tooltip } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery, type ApiQueryStatus } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { notifySummaryStale, onConsoleEvent } from '@/shared/lib/events'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { getDashboard, getDashboardSummary, getLatestOrders, getProductCounts, type Dashboard } from '../api/dashboardApi'
import { DeliveryBreakdown, StatusBreakdown } from '../components/Breakdowns'
import { CatalogAttention } from '../components/CatalogAttention'
import { HealthAlerts } from '../components/HealthAlerts'
import { KpiList } from '../components/KpiList'
import { LatestOrders } from '../components/LatestOrders'
import { PeriodSummary } from '../components/PeriodSummary'
import { LowStock, TopProducts } from '../components/Rankings'
import { SalesChartCard } from '../components/SalesChartCard'
import { WorkQueue } from '../components/WorkQueue'
import { DEFAULT_PERIOD, PERIODS, readPeriod, type Metric } from '../lib/insights'
import './dashboard.css'

const PERIOD_OPTIONS = PERIODS.map((period) => ({ value: String(period), label: `${period} днів` }))

export function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const days = readPeriod(params)
  const [metric, setMetric] = useState<Metric>('revenue')
  const { can } = usePermissions()
  const canOrders = can(PermissionKeys.Orders.View)
  const canRequests = can(PermissionKeys.Requests.View)
  const canCatalog = can(PermissionKeys.Catalog.ViewProducts)
  const canIntegration = can(PermissionKeys.Integration.ViewStatus)

  const dashboard = useApiQuery(`dashboard:${days}`, () => getDashboard(days))
  const summary = useApiQuery('dashboard-summary', () => getDashboardSummary())
  const latest = useApiQuery('dashboard-latest', () => getLatestOrders(), { enabled: canOrders })
  const productCounts = useApiQuery('dashboard-product-counts', () => getProductCounts(), { enabled: canCatalog })
  const reloadSummary = summary.reload

  useEffect(() => onConsoleEvent('summary-stale', reloadSummary), [reloadSummary])

  function setPeriod(value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === String(DEFAULT_PERIOD)) next.delete('days')
        else next.set('days', value)
        return next
      },
      { replace: true },
    )
  }

  function refresh() {
    dashboard.reload()
    if (canOrders) latest.reload()
    if (canCatalog) productCounts.reload()
    notifySummaryStale()
  }

  return (
    <div className="dash-page">
      <PageHeader title="Дашборд" />

      <div className="dash-toolbar">
        <p className="dash-toolbar-note">
          Останні {days} днів порівняно з попередніми {days}. Час за Києвом.
        </p>
        <div className="dash-toolbar-actions">
          <SegmentedControl aria-label="Період" data={PERIOD_OPTIONS} value={String(days)} onChange={setPeriod} />
          <Tooltip label="Оновити">
            <ActionIcon variant="default" size={36} aria-label="Оновити" loading={dashboard.isFetching || summary.isFetching || productCounts.isFetching} onClick={refresh}>
              <IconRefresh size={17} stroke={1.7} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      <div className="dash-body">
        {summary.data ? (
          <>
            <HealthAlerts summary={summary.data} canOpen={canIntegration} />
            <WorkQueue summary={summary.data} canOrders={canOrders} canRequests={canRequests} />
          </>
        ) : null}

        {canCatalog && productCounts.status !== 'forbidden' ? (
          <CatalogAttention counts={productCounts.data} status={productCounts.status} onRetry={productCounts.reload} />
        ) : null}

        <DashboardInsights
          data={dashboard.status === 'ready' ? dashboard.data : undefined}
          status={dashboard.status}
          problem={dashboard.problem}
          dimmed={dashboard.isFetching && dashboard.data !== undefined}
          metric={metric}
          onMetric={setMetric}
          onRetry={dashboard.reload}
          canOrders={canOrders}
          canCatalog={canCatalog}
        />

        {canOrders ? (
          <LatestOrders
            items={latest.data?.items}
            status={latest.status}
            problem={latest.problem}
            isLoading={latest.isLoading}
            isFetching={latest.isFetching}
            onRetry={latest.reload}
          />
        ) : null}
      </div>
    </div>
  )
}

type InsightsProps = {
  data: Dashboard | undefined
  status: ApiQueryStatus
  problem: unknown
  dimmed: boolean
  metric: Metric
  onMetric: (metric: Metric) => void
  onRetry: () => void
  canOrders: boolean
  canCatalog: boolean
}

function DashboardInsights({ data, status, problem, dimmed, metric, onMetric, onRetry, canOrders, canCatalog }: InsightsProps) {
  if (status === 'forbidden') return <PageState kind="forbidden" description={problemMessage(problem, 'Недостатньо прав для перегляду показників.')} />
  if (status === 'error') return <PageState kind="error" description={problemMessage(problem, 'Не вдалося завантажити показники.')} onRetry={onRetry} />
  if (!data) {
    return (
      <div className="dash-skeleton" aria-busy="true" aria-label="Завантаження показників">
        <div className="dash-kpis">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} height={112} radius={12} />
          ))}
        </div>
        <Skeleton height={380} radius={12} />
      </div>
    )
  }

  return (
    <div className="dash-insights" data-fetching={dimmed || undefined}>
      <KpiList data={data} />

      <div className="dash-grid">
        <SalesChartCard data={data} metric={metric} onMetric={onMetric} />
        <div className="dash-side">
          <StatusBreakdown data={data} canOrders={canOrders} />
          <DeliveryBreakdown data={data} />
        </div>
      </div>

      <div className="dash-grid is-even">
        <TopProducts data={data} canOpen={canCatalog} />
        <LowStock data={data} canOpen={canCatalog} />
        <PeriodSummary data={data} />
      </div>
    </div>
  )
}
