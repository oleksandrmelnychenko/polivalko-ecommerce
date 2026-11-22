import { ActionIcon, Button, Menu, SegmentedControl, Skeleton, Tooltip } from '@mantine/core'
import { IconCheck, IconDatabase, IconRefresh, IconShoppingCart } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery, type ApiQueryStatus } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { notifySummaryStale, onConsoleEvent } from '@/shared/lib/events'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { getDashboard, getDashboardCustomers, getDashboardRequests, getDashboardSummary, getDocumentSales, getLatestOrders, getProductCounts, type Dashboard } from '../api/dashboardApi'
import { DocumentKpis, DocumentPeriodSummary, DocumentSalesFeatures } from '../components/DocumentSalesReport'
import { DocumentProducts } from '../components/DocumentProducts'
import { DeliveryBreakdown, StatusBreakdown } from '../components/Breakdowns'
import { CompletionCard } from '../components/CompletionCard'
import { KpiList } from '../components/KpiList'
import { LatestOrders } from '../components/LatestOrders'
import { PeriodSummary } from '../components/PeriodSummary'
import { LowStock, TopProducts } from '../components/Rankings'
import { StockTurnover } from '../components/StockTurnover'
import { SalesChartCard } from '../components/SalesChartCard'
import { WorkQueue } from '../components/WorkQueue'
import { QueueTile } from '../components/QueueTile'
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
  const canCustomers = can(PermissionKeys.Customers.View)
  const canCatalog = can(PermissionKeys.Catalog.ViewProducts)
  const canDocuments = can(PermissionKeys.Analytics.ViewProducts) && can(PermissionKeys.Accounting.View)
  const documents = canDocuments && params.get('source') !== 'web'
  const sales = useApiQuery('document-sales-' + days, () => getDocumentSales(days), { enabled: documents })
  const report = documents && sales.status === 'ready' ? sales.data : undefined

  const dashboard = useApiQuery(`dashboard:${days}`, () => getDashboard(days), { keepPrevious: true })
  const summary = useApiQuery('dashboard-summary', () => getDashboardSummary())
  const latest = useApiQuery('dashboard-latest', () => getLatestOrders(), { enabled: canOrders })
  const productCounts = useApiQuery('dashboard-product-counts', () => getProductCounts(), { enabled: canCatalog })
  const customers = useApiQuery('dashboard-customers', getDashboardCustomers, { enabled: canCustomers })
  const requests = useApiQuery('dashboard-requests', getDashboardRequests, { enabled: canRequests })
  const totals = [
    { allowed: canCatalog, query: productCounts, count: productCounts.data?.all, label: 'Товари в каталозі', href: '/catalog/products' },
    { allowed: canOrders, query: latest, count: latest.data?.totalItems, label: 'Вебзамовлення', href: '/sales/orders' },
    { allowed: canCustomers, query: customers, count: customers.data?.totalItems, label: 'Покупці інтернет-магазину', href: '/sales/customers' },
    { allowed: canRequests, query: requests, count: requests.data?.totalItems, label: 'Заявки на послуги', href: '/sales/requests' },
  ].filter(item => item.allowed && item.query.status !== 'forbidden')
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
    if (documents) sales.reload()
    if (canOrders) latest.reload()
    if (canCatalog) productCounts.reload()
    if (canCustomers) customers.reload()
    if (canRequests) requests.reload()
    notifySummaryStale()
  }

  function setPurchasesOpen(open: boolean) {
    setParams(current => {
      const next = new URLSearchParams(current)
      if (open) next.set('purchases', '1')
      else next.delete('purchases')
      return next
    }, { replace: true, preventScrollReset: true })
  }

  return (
    <div className="dash-page">
      <PageHeader title="Дашборд" actions={
        <div className="dash-toolbar-actions">
          {documents && canCatalog && <Tooltip label="Закупівлі за постачальниками">
            <Button className="dash-purchases-trigger" size="xs" radius="xl" variant="default"
              aria-label="Закупівлі за постачальниками" aria-haspopup="dialog" onClick={() => setPurchasesOpen(true)}>
              <IconShoppingCart size={16} aria-hidden="true" /><span>Закупівлі</span>
            </Button>
          </Tooltip>}
          {canDocuments && <Menu position="bottom-start">
            <Menu.Target>
              <Button className="dash-source" size="xs" radius="xl" variant="default"
                aria-label={'Джерело продажів: ' + (documents ? 'Документи продажу' : 'Інтернет-магазин')}>
                <IconDatabase size={16} /><span>{documents ? 'Документи продажу' : 'Інтернет-магазин'}</span>
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Джерело продажів</Menu.Label>
              {[['documents', 'Документи продажу'], ['web', 'Інтернет-магазин']].map(([value, label]) =>
                <Menu.Item key={value} rightSection={(documents ? 'documents' : 'web') === value && <IconCheck size={14} />}
                  onClick={() => setParams(current => {
                    const next = new URLSearchParams(current)
                    next.set('source', value)
                    return next
                  })}>{label}</Menu.Item>)}
            </Menu.Dropdown>
          </Menu>}
          <SegmentedControl aria-label="Період" data={PERIOD_OPTIONS} value={String(days)} onChange={setPeriod} />
          <Tooltip label="Оновити">
            <ActionIcon variant="default" size={36} aria-label="Оновити" loading={sales.isFetching || dashboard.isFetching || summary.isFetching || totals.some(item => item.query.isFetching)} onClick={refresh}>
              <IconRefresh size={17} stroke={1.7} />
            </ActionIcon>
          </Tooltip>
        </div>
      } />

      <div className="dash-body">
        {report && <DocumentKpis data={report} />}
        {!documents && dashboard.status === 'ready' && dashboard.data && <KpiList data={dashboard.data} />}
        {documents && (sales.status === 'error' || sales.status === 'forbidden'
          ? <PageState kind={sales.status} description={problemMessage(sales.problem, 'Не вдалося завантажити продажі за документами.')} onRetry={sales.reload} />
          : report ? <DocumentSalesFeatures data={report} metric={metric} onMetric={setMetric} /> : <Skeleton height={220} radius={12} role="status" aria-label="Завантаження продажів за документами" />)}
        {!documents && dashboard.status === 'ready' && dashboard.data &&
          <div className="dash-feature-row">
            <SalesChartCard data={dashboard.data} metric={metric} onMetric={setMetric} />
            <CompletionCard statuses={dashboard.data.byStatus} />
          </div>}
        <div className="dash-overview-row">
          {report && <DocumentPeriodSummary data={report} />}
          {!documents && dashboard.status === 'ready' && dashboard.data && <PeriodSummary data={dashboard.data} />}
          {summary.data && <WorkQueue summary={summary.data} canOrders={canOrders} canRequests={canRequests} />}
        {totals.length > 0 && <section className="dash-card dash-work" aria-labelledby="dash-totals-title">
          <header className="dash-card-head"><h2 className="dash-card-title" id="dash-totals-title">У системі за весь час</h2></header>
          <ul className="dash-queue">
            {totals.map(item => <QueueTile key={item.href} count={item.count} label={item.label} href={item.href} hot={false} busy={item.query.isLoading} />)}
          </ul>
          {totals.some(item => item.query.status === 'error') && <p className="dash-muted" role="status">Частину показників не вдалося завантажити. <button className="dash-retry" type="button" onClick={() => totals.filter(item => item.query.status === 'error').forEach(item => item.query.reload())}>Повторити</button></p>}
        </section>}
        </div>
        {!documents && <DashboardInsights
          data={dashboard.status === 'ready' ? dashboard.data : undefined}
          status={dashboard.status}
          problem={dashboard.problem}
          dimmed={dashboard.isFetching && dashboard.data !== undefined}
          onRetry={dashboard.reload}
          canOrders={canOrders}
          canCatalog={canCatalog}
        />}
        {documents && <div className="dash-grid is-even">
          {report && <DocumentProducts key={report.start} data={report} />}
          {canCatalog && <StockTurnover days={days} purchasesOpen={params.get('purchases') === '1'} closePurchases={() => setPurchasesOpen(false)} />}
        </div>}
        {report && report.excluded > 0 && <p className="dash-muted" role="status">Документів із непідтвердженою сумою або статусом · {report.excluded.toLocaleString('uk-UA')}.</p>}

        {!documents && canOrders ? (
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
  onRetry: () => void
  canOrders: boolean
  canCatalog: boolean
}

function DashboardInsights({ data, status, problem, dimmed, onRetry, canOrders, canCatalog }: InsightsProps) {
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
      <div className="dash-grid is-even">
          <StatusBreakdown data={data} canOrders={canOrders} />
          <DeliveryBreakdown data={data} />
      </div>

      <div className="dash-grid is-even">
        <TopProducts data={data} canOpen={canCatalog} />
        <LowStock data={data} canOpen={canCatalog} />
      </div>
    </div>
  )
}
