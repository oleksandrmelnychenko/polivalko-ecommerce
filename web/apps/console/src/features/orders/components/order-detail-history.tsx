import { formatDateTime } from "@polivalko/shared/lib/format";
import { orderStatusLabel } from "@polivalko/shared/lib/labels";
import type { ConsoleOrder } from "../lib/types";

export function OrderDetailHistory({ order: o }: { order: ConsoleOrder }) {
  return (
    <section className="console-card" aria-labelledby="history-title">
      <div className="console-card__head">
        <h2 id="history-title">Історія</h2>
      </div>
      <div className="console-card__body">
        <ol className="console-timeline">
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
