import type { Dashboard, Metric } from "../lib/types";
import { DeliveryBreakdown } from "./delivery-breakdown";
import { KpiList } from "./kpi-list";
import { LowStock } from "./low-stock";
import { PeriodSummary } from "./period-summary";
import { SalesChartCard } from "./sales-chart-card";
import { StatusBreakdown } from "./status-breakdown";
import { TopProducts } from "./top-products";

export function Insights({ data, metric, onMetric }: { data: Dashboard; metric: Metric; onMetric: (m: Metric) => void }) {
  return (
    <>
      <KpiList data={data} />

      <div className="dash-grid">
        <SalesChartCard data={data} metric={metric} onMetric={onMetric} />

        <div className="dash-side">
          <StatusBreakdown data={data} />

          <DeliveryBreakdown data={data} />
        </div>
      </div>

      <div className="dash-grid dash-grid--even">
        <TopProducts data={data} />

        <LowStock data={data} />

        <PeriodSummary data={data} />
      </div>
    </>
  );
}
