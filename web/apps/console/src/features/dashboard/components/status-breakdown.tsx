import Link from "next/link";
import { StatusText } from "@/features/orders";
import { orderStatusLabel } from "@polivalko/shared/lib/labels";
import { share } from "../lib/share";
import type { Dashboard } from "../lib/types";

export function StatusBreakdown({ data }: { data: Dashboard }) {
  const statusTotal = data.byStatus.reduce((s, x) => s + x.count, 0);
  const statusMax = Math.max(...data.byStatus.map((s) => s.count), 1);
  return (
    <section className="console-card" aria-labelledby="status-title">
      <div className="console-card__head">
        <h2 id="status-title">Статуси</h2>
        <span className="muted">{statusTotal} замовл.</span>
      </div>
      <div className="console-card__body">
        {data.byStatus.length === 0 ? (
          <p className="muted">Замовлень за період немає.</p>
        ) : (
          <ul className="barlist">
            {[...data.byStatus]
              .sort((a, b) => b.count - a.count)
              .map((s) => (
                <li key={s.status}>
                  <span className="barlist__name">
                    <Link href={`/orders?status=${s.status}`} aria-label={`${orderStatusLabel[s.status]}: відкрити замовлення`}>
                      <StatusText status={s.status} />
                    </Link>
                  </span>
                  <span className="barlist__value">
                    {s.count}
                    <small>{share(s.count, statusTotal)}</small>
                  </span>
                  <span className="barlist__track" aria-hidden="true">
                    <span className="barlist__fill" style={{ display: "block", width: `${(s.count / statusMax) * 100}%` }} />
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </section>
  );
}
