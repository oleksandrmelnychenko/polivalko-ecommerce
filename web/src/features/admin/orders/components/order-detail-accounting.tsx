import { formatDateTime } from "@/shared/lib/format";
import type { AdminOrder } from "../lib/types";

export function OrderDetailAccounting({ order: o }: { order: AdminOrder }) {
  return (
    <section className="admin-card" aria-labelledby="system-title">
      <div className="admin-card__head">
        <h2 id="system-title">Облік</h2>
      </div>
      <div className="admin-card__body">
        <dl className="buybox__meta">
          <dt>Продавець</dt>
          <dd>
            {o.sellerName}
            {o.sellerTaxId && <span className="muted"> ({o.sellerTaxId})</span>}
          </dd>
          <dt>Navkolo</dt>
          <dd>
            {o.navkoloOrderRef ? (
              <>
                <span className="code">{o.navkoloOrderRef}</span>
                {o.navkoloExportedAt && <span className="muted">, {formatDateTime(o.navkoloExportedAt)}</span>}
              </>
            ) : (
              <span className="muted">ще не передано (черга повторить спробу)</span>
            )}
          </dd>
        </dl>
      </div>
    </section>
  );
}
