import { formatMoney } from "@/shared/lib/format";
import type { useRefund } from "../hooks/use-refund";
import type { AdminOrder } from "../lib/types";

export function OrderRefundForm({ order, refund }: { order: AdminOrder; refund: ReturnType<typeof useRefund> }) {
  const { quantities, setQuantities, reason, setReason, busy, error, refundable, amount, submit } = refund;
  return (
    <form className="refund-form" onSubmit={submit}>
      <p className="field__help">
        {order.refundMethod === "provider"
          ? "Кошти повернуться на картку покупця через платіжну систему; чек повернення видасться автоматично."
          : "Повернення готівкою чи переказом поза сайтом: сайт зафіксує його й видасть чек повернення, якщо продаж фіскалізував сайт."}
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Товар</th>
              <th scope="col" className="num">
                Можна
              </th>
              <th scope="col" className="num">
                Повернути
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items
              .filter((i) => refundable.has(i.productId))
              .map((i) => (
                <tr key={i.productId}>
                  <td>{i.name}</td>
                  <td className="num">{refundable.get(i.productId)}</td>
                  <td className="num">
                    <label className="visually-hidden" htmlFor={`refund-${i.productId}`}>
                      Скільки повернути: {i.name}
                    </label>
                    <input
                      id={`refund-${i.productId}`}
                      type="number"
                      min={0}
                      max={refundable.get(i.productId)}
                      value={quantities[i.productId] ?? 0}
                      onChange={(e) => setQuantities((q) => ({ ...q, [i.productId]: Math.max(0, Math.min(Number(e.target.value) || 0, refundable.get(i.productId) ?? 0)) }))}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="field">
        <label htmlFor="refund-reason">Причина</label>
        <input id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
      </div>
      <div className="admin-actions">
        <button type="submit" className="btn btn--small" disabled={busy || amount === 0 || reason.trim().length === 0} aria-busy={busy}>
          Повернути {amount > 0 ? formatMoney({ value: amount.toFixed(2), currency: "UAH" }) : ""}
        </button>
      </div>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
