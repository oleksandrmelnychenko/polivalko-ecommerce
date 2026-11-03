import { formatDateTime } from "@/shared/lib/format";
import { orderStatusLabel } from "@/shared/lib/labels";
import type { AdminOrder } from "../lib/types";

export function OrderDetailHistory({ order: o }: { order: AdminOrder }) {
  return (
    <section className="admin-card" aria-labelledby="history-title">
      <div className="admin-card__head">
        <h2 id="history-title">Історія</h2>
      </div>
      <div className="admin-card__body">
        <ol className="admin-timeline">
          {[...o.history].reverse().map((h, idx) => (
            <li key={idx}>
              <strong>{orderStatusLabel[h.to]}</strong>
              <span>
                {formatDateTime(h.at)} · {h.by}
                {h.from ? ` · було «${orderStatusLabel[h.from]}»` : ""}
              </span>
              {h.reason && <q>{h.reason}</q>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
