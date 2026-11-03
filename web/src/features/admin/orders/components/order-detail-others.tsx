"use client";

import Link from "next/link";
import { useAdminData } from "@/shared/admin/use-admin-data";
import { formatDateTime, formatMoney } from "@/shared/lib/format";
import { orderStatusLabel } from "@/shared/lib/labels";
import { getOrders } from "../api/client";

export function OrderDetailOthers({ phone, current }: { phone: string; current: string }) {
  const others = useAdminData(`others|${phone}`, () => getOrders({ q: phone, page: 1, pageSize: 6 }));
  const rows = others.data?.items.filter((o) => o.number !== current) ?? [];
  const total = Math.max((others.data?.totalItems ?? 1) - 1, 0);
  return (
    <section className="admin-card no-print" aria-labelledby="others-title">
      <div className="admin-card__head">
        <h2 id="others-title">Інші замовлення</h2>
        {total > rows.length && (
          <Link href={`/admin/orders?q=${encodeURIComponent(phone)}`} className="link">
            Усі {total}
          </Link>
        )}
      </div>
      <div className="admin-card__body" style={{ paddingBlock: "8px" }}>
        {others.status === "loading" ? (
          <p className="muted">Завантажуємо…</p>
        ) : rows.length === 0 ? (
          <p className="muted" style={{ paddingBlock: "8px" }}>
            Це перше замовлення покупця.
          </p>
        ) : (
          <ul className="other-orders">
            {rows.map((r) => (
              <li key={r.number}>
                <span>
                  <Link href={`/admin/orders/${r.number}`}>{r.number}</Link>
                  <span className="cell-sub">{formatDateTime(r.createdAt)}</span>
                </span>
                <span style={{ textAlign: "right" }}>
                  <span className="cell-strong">{formatMoney(r.total)}</span>
                  <span className="cell-sub">{orderStatusLabel[r.status]}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
