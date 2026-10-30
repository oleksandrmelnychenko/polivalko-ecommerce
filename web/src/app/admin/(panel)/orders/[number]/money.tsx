"use client";

import { useRef, useState, type FormEvent } from "react";
import { browserApi, newIdempotencyKey, type Problem } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { csrfHeader, forgetCsrf, useAdminData } from "@/lib/admin";
import { formatDateTime, formatMoney } from "@/lib/format";
import { receiptKindLabel, refundStatusLabel } from "@/lib/labels";
import { StateBox } from "../../ui";

type AdminOrder = components["schemas"]["AdminOrderDto"];

const attemptLabel: Record<string, string> = {
  created: "Створено",
  processing: "Обробляється",
  succeeded: "Успішно",
  failed: "Відмова",
  expired: "Прострочено",
  reversed: "Повернено",
};

/** Спроби онлайн-оплати й фіскальні чеки: що саме відбулося з грошима (розділ 6 ТЗ). */
export function PaymentsAndReceipts({ number, version }: { number: string; version: string }) {
  const payments = useAdminData(`payments-${number}-${version}`, () =>
    browserApi.GET("/api/v1/admin/orders/{number}/payments", { params: { path: { number } } }),
  );
  const receipts = useAdminData(`receipts-${number}-${version}`, () =>
    browserApi.GET("/api/v1/admin/orders/{number}/receipts", { params: { path: { number } } }),
  );

  return (
    <>
      <section className="admin-subsection" aria-labelledby="payments-title">
        <h2 id="payments-title">Онлайн-оплата</h2>
        <StateBox state={payments} empty={payments.data?.length === 0 ? "Спроб онлайн-оплати не було." : undefined}>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Створено</th>
                  <th scope="col">Провайдер</th>
                  <th scope="col">Стан</th>
                  <th scope="col" className="num">
                    Сума
                  </th>
                  <th scope="col">Повідомлень</th>
                </tr>
              </thead>
              <tbody>
                {payments.data?.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDateTime(p.createdAt)}</td>
                    <td>
                      {p.provider}
                      <br />
                      <span className="muted code">{p.providerPaymentId}</span>
                    </td>
                    <td>
                      <span className={p.status === "succeeded" ? "badge badge--ok" : p.status === "failed" ? "badge badge--bad" : "badge"}>
                        {attemptLabel[p.status] ?? p.status}
                      </span>
                      {p.failureReason && (
                        <>
                          <br />
                          <span className="muted">{p.failureReason}</span>
                        </>
                      )}
                    </td>
                    <td className="num">{formatMoney(p.amount)}</td>
                    <td className="num">{p.eventsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateBox>
      </section>

      <section className="admin-subsection" aria-labelledby="receipts-title">
        <h2 id="receipts-title">Фіскальні чеки</h2>
        <StateBox state={receipts} empty={receipts.data?.length === 0 ? "Чеків ще немає: їх видає ПРРО за погодженими правилами." : undefined}>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Чек</th>
                  <th scope="col">Фіскальний номер</th>
                  <th scope="col" className="num">
                    Сума
                  </th>
                  <th scope="col">Стан</th>
                </tr>
              </thead>
              <tbody>
                {receipts.data?.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {receiptKindLabel[r.kind] ?? r.kind}
                      <br />
                      <span className="muted">
                        {r.provider}, {r.paymentType === "CASH" ? "готівка" : "безготівково"}
                      </span>
                    </td>
                    <td>
                      {r.fiscalCode ? (
                        r.url ? (
                          <a href={r.url} className="link code" target="_blank" rel="noopener">
                            {r.fiscalCode}
                          </a>
                        ) : (
                          <span className="code">{r.fiscalCode}</span>
                        )
                      ) : (
                        "ще немає"
                      )}
                    </td>
                    <td className="num">{formatMoney(r.amount)}</td>
                    <td>
                      {r.status === "issued" ? `Видано ${r.issuedAt ? formatDateTime(r.issuedAt) : ""}` : r.status === "pending" ? "Видається" : "Помилка"}
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
        </StateBox>
      </section>
    </>
  );
}

/**
 * Повне чи часткове повернення за позиціями. Для онлайн-оплати гроші повертає провайдер у фоні;
 * для оплати під час отримання сайт фіксує повернення й видає чек повернення.
 */
export function Refunds({ order, onChange }: { order: AdminOrder; onChange: (order: AdminOrder) => void }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);

  const refundable = new Map(order.refundable.map((r) => [r.productId, r.quantity]));
  const amount = order.items.reduce((sum, i) => sum + (quantities[i.productId] ?? 0) * Number(i.unitPrice.value), 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    key.current ??= newIdempotencyKey();
    const lines = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    const send = async () =>
      browserApi.POST("/api/v1/admin/orders/{number}/refunds", {
        params: { path: { number: order.number }, header: { "Idempotency-Key": key.current! } },
        headers: await csrfHeader(),
        body: { lines, reason },
      });
    let result = await send();
    if ((result.error as Problem | undefined)?.code === "auth.csrf_invalid") {
      forgetCsrf();
      result = await send();
    }
    setBusy(false);
    if (result.data) {
      key.current = null;
      setQuantities({});
      setReason("");
      onChange(result.data);
    } else {
      const problem = result.error as Problem | undefined;
      setError(problem?.errors ? Object.values(problem.errors).flat().join(" ") : (problem?.title ?? "Повернення не оформлено."));
    }
  }

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
      ) : (
        order.refunds.length === 0 && (
          <p className="muted">Повернути можна оплачене онлайн замовлення або виконане замовлення з оплатою під час отримання.</p>
        )
      )}
    </section>
  );
}
