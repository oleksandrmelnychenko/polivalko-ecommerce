"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ChevronRightIcon, PhoneIcon, PrintIcon } from "@/components/icons";
import { browserApi } from "@/lib/api/browser";
import type { OrderStatus } from "@/lib/api/server";
import { useAdminData } from "@/lib/admin";
import { formatDateTime, formatMoney } from "@/lib/format";
import { thumb } from "@/lib/images";
import { deliveryMethodLabel, orderStatusLabel, paymentMethodLabel } from "@/lib/labels";
import { useSummary } from "../../admin-shell";
import { mutate, problemTitle } from "../../catalog/_shared";
import { PaymentStatusText, StateBox, StatusText } from "../../ui";
import { PaymentsAndReceipts, Refunds } from "./money";

export default function AdminOrderPage() {
  const { number } = useParams<{ number: string }>();
  const order = useAdminData(number, () => browserApi.GET("/api/v1/admin/orders/{number}", { params: { path: { number } } }));
  const { reload: reloadSummary } = useSummary();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function change(status: OrderStatus) {
    setBusy(status);
    setError(null);
    const result = await mutate((headers) =>
      browserApi.POST("/api/v1/admin/orders/{number}/status", { params: { path: { number } }, headers, body: { status, reason: reason.trim() || null } }),
    );
    setBusy(null);
    if (result.data) {
      order.setData(result.data);
      setReason("");
      reloadSummary();
    } else {
      setError(problemTitle(result.error, "Статус не змінено."));
    }
  }

  const o = order.data;

  return (
    <>
      <nav className="crumbs" aria-label="Хлібні крихти">
        <ol>
          <li>
            <Link href="/admin/orders">Замовлення</Link>
          </li>
          <li aria-current="page">{number}</li>
        </ol>
      </nav>
      <StateBox state={order}>
        {o && (
          <>
            <p className="print-only">
              <strong>PoliValko</strong> · накладна для комплектування · надруковано {formatDateTime(new Date().toISOString())}
            </p>
            <div className="admin-order-head">
              <div className="admin-order-head__title">
                <h1 className="admin-title">{o.number}</h1>
                <StatusText status={o.status} />
                <PaymentStatusText status={o.paymentStatus} />
                <span className="muted">створено {formatDateTime(o.createdAt)}</span>
              </div>
              <div className="admin-head__actions no-print">
                <a className="btn btn--quiet" href={`tel:${o.phone}`}>
                  <PhoneIcon />
                  Подзвонити
                </a>
                <button type="button" className="btn btn--quiet" onClick={() => window.print()}>
                  <PrintIcon />
                  Друк
                </button>
              </div>
            </div>

            <div className="admin-columns">
              <div className="admin-stack">
                <section className="admin-card" aria-labelledby="items-title">
                  <div className="admin-card__head">
                    <h2 id="items-title">Склад</h2>
                    <span className="muted">
                      {o.items.reduce((s, i) => s + i.quantity, 0)} шт. · {o.items.length} поз.
                    </span>
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th scope="col">Товар</th>
                          <th scope="col" className="num">
                            Ціна
                          </th>
                          <th scope="col" className="num">
                            Кількість
                          </th>
                          <th scope="col" className="num">
                            Сума
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.items.map((i) => (
                          <tr key={i.productId}>
                            <td>
                              <span className="cell-main">
                                {i.imageUrl ? <img className="admin-thumb" src={thumb(i.imageUrl, 120)} alt="" loading="lazy" /> : <span className="admin-thumb" />}
                                <span>
                                  <a href={`/product/${i.slug}`} className="cell-strong" target="_blank" rel="noopener" style={{ textDecoration: "none" }}>
                                    {i.name}
                                  </a>
                                  <span className="cell-sub code">{i.sku}</span>
                                </span>
                              </span>
                            </td>
                            <td className="num">{formatMoney(i.unitPrice)}</td>
                            <td className="num">× {i.quantity}</td>
                            <td className="num cell-strong">{formatMoney(i.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row" colSpan={3}>
                            Разом до сплати
                          </th>
                          <td className="num">
                            <strong style={{ fontSize: "1.0625rem" }}>{formatMoney(o.total)}</strong>
                          </td>
                        </tr>
                        {Number(o.refundedAmount.value) > 0 && (
                          <tr>
                            <th scope="row" colSpan={3}>
                              Повернено
                            </th>
                            <td className="num">−{formatMoney(o.refundedAmount)}</td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                </section>

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

                <div className="no-print">
                  <Refunds order={o} onChange={order.setData} />
                  <PaymentsAndReceipts number={o.number} version={`${o.paymentStatus}-${o.refunds.length}-${o.status}`} />
                </div>
              </div>

              <div className="admin-stack">
                <aside className="admin-panel admin-panel--status" aria-labelledby="status-title">
                  <h2 id="status-title">Змінити статус</h2>
                  {o.allowedTransitions.length === 0 ? (
                    <p className="muted">Зі статусу «{orderStatusLabel[o.status]}» переходів немає.</p>
                  ) : (
                    <>
                      <div className="field">
                        <label htmlFor="reason">Причина або коментар</label>
                        <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Необов'язково…" autoComplete="off" />
                      </div>
                      <div className="status-actions">
                        {o.allowedTransitions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={s === "cancelled" ? "btn btn--danger" : "btn"}
                            disabled={busy !== null}
                            aria-busy={busy === s}
                            onClick={() => change(s)}
                          >
                            {busy === s ? "Змінюємо…" : orderStatusLabel[s]}
                            <ChevronRightIcon />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <p className="field__help" style={{ marginTop: "var(--space-sm)" }}>
                    Статус оплати змінює лише підтвердження платіжного провайдера.
                  </p>
                  {error && (
                    <p className="notice notice--error" role="alert" style={{ marginTop: "var(--space-sm)" }}>
                      {error}
                    </p>
                  )}
                </aside>

                <section className="admin-card" aria-labelledby="buyer-title">
                  <div className="admin-card__head">
                    <h2 id="buyer-title">Покупець</h2>
                  </div>
                  <div className="admin-card__body">
                    <dl className="buybox__meta">
                      <dt>Ім&apos;я</dt>
                      <dd>
                        <strong>{o.customerName}</strong>
                      </dd>
                      <dt>Телефон</dt>
                      <dd>
                        <a className="link" href={`tel:${o.phone}`}>
                          {o.phone}
                        </a>
                      </dd>
                      {o.email && (
                        <>
                          <dt>Email</dt>
                          <dd>
                            <a className="link" href={`mailto:${o.email}`}>
                              {o.email}
                            </a>
                          </dd>
                        </>
                      )}
                      <dt>Отримання</dt>
                      <dd>
                        {deliveryMethodLabel[o.deliveryMethod] ?? o.deliveryMethod}
                        {o.settlementName && `: ${o.settlementName}`}
                        {o.warehouseName && `, ${o.warehouseName}`}
                        {o.deliveryAddress && `, ${o.deliveryAddress}`}
                        {o.pickupAddress && `: ${o.pickupAddress}`}
                      </dd>
                      <dt>Оплата</dt>
                      <dd>{paymentMethodLabel[o.paymentMethod] ?? o.paymentMethod}</dd>
                      {o.comment && (
                        <>
                          <dt>Коментар</dt>
                          <dd>{o.comment}</dd>
                        </>
                      )}
                    </dl>
                  </div>
                </section>

                <OtherOrders phone={o.phone} current={o.number} />

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
              </div>
            </div>
          </>
        )}
      </StateBox>
    </>
  );
}

/** Інші замовлення того самого телефону: постійний це покупець чи новий. */
function OtherOrders({ phone, current }: { phone: string; current: string }) {
  const others = useAdminData(`others|${phone}`, () => browserApi.GET("/api/v1/admin/orders", { params: { query: { q: phone, page: 1, pageSize: 6 } } }));
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
