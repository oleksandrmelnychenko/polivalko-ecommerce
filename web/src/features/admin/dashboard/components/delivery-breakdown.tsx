import { deliveryMethodLabel } from "@/shared/lib/labels";
import { share } from "../lib/share";
import type { Dashboard } from "../lib/types";

export function DeliveryBreakdown({ data }: { data: Dashboard }) {
  const deliveryTotal = data.byDelivery.reduce((s, x) => s + x.count, 0);
  const deliveryMax = Math.max(...data.byDelivery.map((s) => s.count), 1);
  return (
    <section className="admin-card" aria-labelledby="delivery-title">
      <div className="admin-card__head">
        <h2 id="delivery-title">Отримання</h2>
      </div>
      <div className="admin-card__body">
        {data.byDelivery.length === 0 ? (
          <p className="muted">Замовлень за період немає.</p>
        ) : (
          <ul className="barlist">
            {[...data.byDelivery]
              .sort((a, b) => b.count - a.count)
              .map((d) => (
                <li key={d.method}>
                  <span className="barlist__name">{deliveryMethodLabel[d.method] ?? d.method}</span>
                  <span className="barlist__value">
                    {d.count}
                    <small>{share(d.count, deliveryTotal)}</small>
                  </span>
                  <span className="barlist__track" aria-hidden="true">
                    <span className="barlist__fill" style={{ display: "block", width: `${(d.count / deliveryMax) * 100}%` }} />
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </section>
  );
}
