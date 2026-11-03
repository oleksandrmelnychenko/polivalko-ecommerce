import type { Dashboard, Metric } from "../lib/types";
import { RevenueChart } from "./revenue-chart";

export function SalesChartCard({ data, metric, onMetric }: { data: Dashboard; metric: Metric; onMetric: (m: Metric) => void }) {
  return (
    <section className="admin-card" aria-labelledby="chart-title">
      <div className="admin-card__head">
        <h2 id="chart-title">{metric === "revenue" ? "Виручка по днях" : "Замовлення по днях"}</h2>
        <div className="seg" role="group" aria-label="Показник графіка">
          <button type="button" aria-pressed={metric === "revenue"} onClick={() => onMetric("revenue")}>
            Виручка
          </button>
          <button type="button" aria-pressed={metric === "orders"} onClick={() => onMetric("orders")}>
            Замовлення
          </button>
        </div>
      </div>
      <div className="admin-card__body">
        <RevenueChart days={data.byDay} metric={metric} />
      </div>
    </section>
  );
}
