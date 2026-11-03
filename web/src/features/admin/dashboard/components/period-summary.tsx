import { formatMoney } from "@/shared/lib/format";
import { bestDay } from "../lib/best-day";
import type { Dashboard } from "../lib/types";
import { Delta } from "./delta";

export function PeriodSummary({ data }: { data: Dashboard }) {
  const { current: c, previous: p } = data;
  return (
    <section className="admin-card" aria-labelledby="period-title">
      <div className="admin-card__head">
        <h2 id="period-title">Підсумок періоду</h2>
      </div>
      <div className="admin-card__body">
        <dl className="buybox__meta">
          <dt>Виручка</dt>
          <dd>
            <strong>{formatMoney(c.revenue)}</strong>
          </dd>
          <dt>Замовлень</dt>
          <dd>{c.orders}</dd>
          <dt>Скасовано</dt>
          <dd>
            {c.cancelled} <Delta current={c.cancelled} previous={p.cancelled} inverse />
          </dd>
          <dt>Середній чек</dt>
          <dd>{formatMoney(c.averageOrder)}</dd>
          <dt>Покупців</dt>
          <dd>{c.customers}</dd>
          <dt>Найкращий день</dt>
          <dd>{bestDay(data)}</dd>
        </dl>
      </div>
    </section>
  );
}
