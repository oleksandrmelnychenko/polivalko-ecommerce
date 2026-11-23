import { Button, SegmentedControl } from '@mantine/core'
import { IconArrowUpRight, IconChartLine, IconPackage, IconReceiptRefund, IconWallet } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MetricLabel } from '@/shared/ui/MetricCard'
import type { ProductAnalytics } from '../api/productAnalyticsApi'
import { axisDate, axisMonth, dateRange, formatAmount, formatDays, formatPercent, formatPrice, formatUnits, monthLabel } from '../lib/format'
import { AnalyticsCard } from './AnalyticsCard'
import { AnalyticsChart } from './AnalyticsChart'
import { DemandChange } from './AnalyticsProducts'

type Props = { report: ProductAnalytics; canOpenProduct: boolean; onSelectProduct: (key: string) => void }
type TrendPoint = ProductAnalytics['trend'][number]
type TrendMetric = { value: string; label: string; description: string; read: (item: TrendPoint) => number; format: (value: number) => string }

const FORECAST_METHODS: Record<string, string> = {
  'weekly-naive': 'Останній тиждень',
  'mean-4': 'Середнє за 4 тижні',
  'weighted-4': 'Зважене середнє за 4 тижні',
  'year-ago': 'Відповідний тиждень торік',
}

const INSIGHT_TYPES: Record<string, string> = {
  trend: 'Попит',
  anomaly: 'Зміна продажів',
  replenish: 'Поповнення',
  'slow-stock': 'Повільний оборот',
  coverage: 'Якість даних',
  forecast: 'Прогноз',
  returns: 'Повернення',
}

export function AnalyticsReport({ report, canOpenProduct, onSelectProduct }: Props) {
  const [metric, setMetric] = useState('units')
  const { coverage, metrics, selectedProduct } = report
  const revenueLabel = coverage.returnsAvailable ? 'Чиста виручка' : 'Виручка продажів'
  // Products are sold in pieces, metres and kilograms, and the source does not say which. Quantities are
  // shown for one product; all products together are measured in money, as the service computes them.
  const allProducts = !selectedProduct
  const trendMetrics: TrendMetric[] = [
    { value: 'revenue', label: 'Виручка', description: revenueLabel, read: (item) => item.netRevenue, format: formatPrice },
  ]
  if (!allProducts) {
    trendMetrics.unshift({ value: 'units', label: 'Продано', description: 'Продано', read: (item) => item.soldUnits, format: formatUnits })
    if (coverage.returnsAvailable) {
      trendMetrics.push({ value: 'returns', label: 'Повернено', description: 'Повернено', read: (item) => item.returnedUnits, format: formatUnits })
    }
  }
  const activeMetric = trendMetrics.find((item) => item.value === metric) ?? trendMetrics[0]

  return (
    <>
      {selectedProduct ? (
        <div className="pa-selection">
          <div>
            <h2>{selectedProduct.name}</h2>
            <p>{selectedProduct.sku || 'Без артикула'}</p>
            {!report.trend.length && selectedProduct.stock != null ? <p>Залишок сайту зараз: {formatUnits(selectedProduct.stock)}</p> : null}
          </div>
          {selectedProduct.catalogProductId && canOpenProduct ? (
            <Button component={Link} to={`/catalog/products/${selectedProduct.catalogProductId}`} variant="default" size="xs" rightSection={<IconArrowUpRight size={15} />}>
              Картка товару
            </Button>
          ) : null}
        </div>
      ) : null}
      {report.trend.length ? (
        <div className="pa-metrics">
          <div className="pa-metric">
            <MetricLabel icon={IconWallet}>{revenueLabel}</MetricLabel>
            <strong>{formatPrice(coverage.returnsAvailable ? metrics.netRevenue : metrics.grossRevenue)}</strong>
            {coverage.returnsAvailable ? <small>{formatPrice(metrics.grossRevenue)} до повернень</small> : null}
            <small><DemandChange current={metrics.netRevenue} previous={metrics.previousNetRevenue} /> до попереднього періоду</small>
          </div>
          {!allProducts && <div className="pa-metric">
            <MetricLabel icon={IconChartLine}>Продано</MetricLabel>
            <strong>{formatUnits(metrics.soldUnits)}</strong>
            <small><DemandChange current={metrics.soldUnits} previous={metrics.previousSoldUnits} /> до попереднього періоду</small>
          </div>}
          <div className="pa-metric">
            <MetricLabel icon={IconReceiptRefund}>Повернення</MetricLabel>
            <strong>{!coverage.returnsAvailable ? '—' : allProducts ? formatPrice(metrics.returnValue) : formatUnits(metrics.returnedUnits)}</strong>
            <small>{!coverage.returnsAvailable ? 'Джерело не надає повних даних' : allProducts ? 'Сума повернень за період' : formatPrice(metrics.returnValue)}</small>
          </div>
          <div className="pa-metric">
            <MetricLabel icon={IconPackage}>{selectedProduct ? 'Залишок сайту зараз' : 'Товари з продажами'}</MetricLabel>
            <strong>{selectedProduct ? selectedProduct.stock == null ? '—' : formatUnits(selectedProduct.stock) : formatAmount(metrics.activeProducts)}</strong>
            <small>{selectedProduct ? selectedProduct.stockDays == null ? 'Покриття запасу не розраховано' : `Запасу орієнтовно на ${formatDays(selectedProduct.stockDays)}` : 'У вибраному періоді'}</small>
          </div>
        </div>
      ) : null}

      {allProducts && report.trend.length ? (
        <p className="pa-muted">Усі товари разом показано у гривнях: вони продаються в різних одиницях, тому їхні кількості не складаємо.
          Продані одиниці й прогноз попиту є у звіті окремого товару.</p>
      ) : null}

      {report.trend.length ? (
        <AnalyticsCard
          title="Динаміка продажів"
          description={dateRange(report.from, report.to)}
          actions={trendMetrics.length > 1 ?
            <SegmentedControl
              size="xs"
              aria-label="Показник графіка продажів"
              value={activeMetric.value}
              onChange={setMetric}
              data={trendMetrics.map(({ value, label }) => ({ value, label }))}
            /> : undefined
          }
        >
          <AnalyticsChart
            key={activeMetric.value}
            label={activeMetric.description}
            variant="bars"
            points={report.trend.map((item) => ({ label: dateRange(item.from, item.to), axisLabel: axisDate(item.from), value: activeMetric.read(item) }))}
            format={activeMetric.format}
          />
        </AnalyticsCard>
      ) : null}

      {(Boolean(report.seasonality?.length) || report.forecast) && <div className="pa-model-grid">
        {report.seasonality?.length ? <AnalyticsCard title="Сезонність" description={allProducts
          ? 'Середня виручка за день у кожному місяці. Індекс 100 — середня виручка за день у межах року.'
          : 'Середні продажі за день у кожному місяці. Індекс 100 — середній попит за день у межах року.'}>
          <AnalyticsChart
            label="Індекс сезонності"
            variant="bars"
            baseline={100}
            points={report.seasonality.map((item) => ({ label: monthLabel(item.month), axisLabel: axisMonth(item.month), value: item.index }))}
            format={formatAmount}
          />
        </AnalyticsCard> : null}

        {report.forecast && <AnalyticsCard title="Прогноз попиту" description="Очікувані продажі в одиницях за тижнями.">
          <div className="pa-forecast-meta">
            <span>{FORECAST_METHODS[report.forecast.method] ?? 'Модель часових рядів'}</span>
            <span title="Зважена абсолютна відсоткова помилка на минулих продажах">Помилка на історії {formatPercent(report.forecast.validationWape / 100)}</span>
          </div>
          <AnalyticsChart
            label="Прогноз попиту за тижнями"
            variant="forecast"
            points={report.forecast.points.map((item) => ({ label: dateRange(item.from, item.to), axisLabel: axisDate(item.from), value: item.soldUnits, low: item.low, high: item.high }))}
            format={formatUnits}
          />
          <p className="pa-forecast-note"><span aria-hidden="true" /> Діапазон невизначеності за історичними похибками</p>
        </AnalyticsCard>}
      </div>}

      {report.insights.length ? (
        <AnalyticsCard title="Сигнали та рекомендації">
          <ul className="pa-insights">
            {report.insights.map((insight) => (
              <li key={`${insight.kind}:${insight.productKey ?? ''}:${insight.title}`} data-kind={insight.kind}>
                <small>{INSIGHT_TYPES[insight.kind] ?? 'Аналітика'}</small>
                <strong>{insight.title}</strong>
                <p>{insight.detail}</p>
                {insight.productKey && insight.productKey !== selectedProduct?.productKey ? (
                  <Button variant="subtle" size="compact-xs" rightSection={<IconArrowUpRight size={14} />} onClick={() => onSelectProduct(insight.productKey!)}>
                    Відкрити звіт товару
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </AnalyticsCard>
      ) : null}
    </>
  )
}
