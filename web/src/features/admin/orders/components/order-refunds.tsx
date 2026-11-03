"use client";

import { formatDateTime, formatMoney } from "@/shared/lib/format";
import { refundStatusLabel } from "@/shared/lib/labels";
import { useRefund } from "../hooks/use-refund";
import type { AdminOrder } from "../lib/types";
import { OrderRefundForm } from "./order-refund-form";

export function OrderRefunds({ order, onChange }: { order: AdminOrder; onChange: (order: AdminOrder) => void }) {
  const refund = useRefund(order, onChange);
  return (
    <section className="admin-subsection" aria-labelledby="refunds-title">
      <h2 id="refunds-title">Повернення</h2>
      {order.refunds.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Коли</th>
                <th scope="col">Товари</th>
                <th scope="col" className="num">
                  Сума
                </th>
                <th scope="col">Стан</th>
              </tr>
            </thead>
            <tbody>
              {order.refunds.map((r) => (
                <tr key={r.id}>
                  <td>
                    {formatDateTime(r.createdAt)}
                    <br />
                    <span className="muted">{r.requestedBy}</span>
                  </td>
                  <td>
                    {r.lines.map((l) => `${l.name} × ${l.quantity}`).join(", ")}
                    <br />
                    <span className="muted">{r.reason}</span>
                  </td>
                  <td className="num">{formatMoney(r.amount)}</td>
                  <td>
                    <span className={r.status === "succeeded" ? "badge badge--ok" : r.status === "failed" ? "badge badge--bad" : "badge"}>
                      {refundStatusLabel[r.status] ?? r.status}
                    </span>
                    <br />
                    <span className="muted">{r.method === "provider" ? "на картку" : "поза сайтом"}</span>
                    {r.error && (
                      <>
                        <br />
                        <span className="muted">{r.error}</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {order.refundMethod && order.refundable.length > 0 ? (
        <OrderRefundForm order={order} refund={refund} />
      ) : (
        order.refunds.length === 0 && (
          <p className="muted">Повернути можна оплачене онлайн замовлення або виконане замовлення з оплатою під час отримання.</p>
        )
      )}
    </section>
  );
}
