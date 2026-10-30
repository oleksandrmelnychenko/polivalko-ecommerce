import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TrackPurchase } from "@/lib/analytics";
import { api } from "@/lib/api/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { thumb } from "@/lib/images";
import { deliveryMethodLabel, orderStatusLabel, paymentMethodLabel, paymentStatusLabel, receiptKindLabel } from "@/lib/labels";
import { PayButton, PaymentPending } from "./pay-button";

export const metadata: Metadata = { title: "Замовлення", robots: { index: false, follow: false } };

export default function OrderPage(props: PageProps<"/order/[number]">) {
  return (
    <div className="container">
      <Suspense fallback={<div className="skeleton" style={{ height: "var(--space-4xl)", marginBlock: "var(--space-2xl)" }} />}>
        <OrderContent {...props} />
      </Suspense>
    </div>
  );
}

/** Сторінка результату (розділ 5 ТЗ): доступ лише за непрогнозованим токеном із посилання; без кешу. */
async function OrderContent({ params, searchParams }: PageProps<"/order/[number]">) {
  // Персональні дані замовлення: лише під час запиту, ніколи в пререндері чи кеші.
  await connection();
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.token === "string" ? sp.token : "";
  if (!token) notFound();

  const [{ data: order }, { data: receipts }] = await Promise.all([
    api.GET("/api/v1/orders/{number}", { params: { path: { number }, query: { token } }, cache: "no-store" }),
    api.GET("/api/v1/orders/{number}/receipts", { params: { path: { number }, query: { token } }, cache: "no-store" }),
  ]);
  if (!order) notFound();

  const returnedFromPayment = sp.payment === "return";
  const where =
    order.deliveryMethod === "pickup"
      ? (order.delivery.pickupAddress ?? "Магазин у Бучі")
      : [order.delivery.settlementName, order.delivery.warehouseName ?? order.delivery.address].filter(Boolean).join(", ");
  const paid = order.paymentStatus === "succeeded" || order.paymentStatus === "partiallyRefunded" || order.paymentStatus === "refunded";
  const heading =
    order.status === "cancelled"
      ? "Замовлення скасоване"
      : order.status === "awaitingConfirmation"
        ? "Заявку прийнято"
        : paid
          ? "Замовлення оплачене"
          : "Дякуємо, замовлення прийнято";

  return (
    <>
      {/* Покупка: оплата карткою підтверджена або замовлення з оплатою під час отримання прийняте. */}
      {(paid || (order.paymentMethod !== "card" && order.status !== "cancelled")) && (
        <TrackPurchase
          orderNumber={order.number}
          items={order.items.map((i) => ({ item_id: i.sku, item_name: i.name, price: Number(i.unitPrice.value), quantity: i.quantity }))}
        />
      )}
      <header className="order-head">
        <div>
          <h1>{heading}</h1>
          <p className="lead" style={{ marginTop: "var(--space-md)" }}>
            Номер <span className="code">{order.number}</span>. Збережіть це посилання, щоб стежити за статусом.
          </p>
          {order.status === "awaitingConfirmation" && (
            <p className="notice" style={{ marginTop: "var(--space-md)" }}>
              Ціну й наявність підтвердить менеджер: зараз ми не змогли звірити їх зі складом. Онлайн-оплата стане доступною
              після підтвердження, резерв до того не діє.
            </p>
          )}
        </div>
        <dl className="buybox__meta">
          <dt>Статус</dt>
          <dd>
            <strong>{orderStatusLabel[order.status]}</strong>
          </dd>
          <dt>Оплата</dt>
          <dd>
            {paymentMethodLabel[order.paymentMethod] ?? order.paymentMethod}, {paymentStatusLabel[order.paymentStatus].toLowerCase()}
          </dd>
          <dt>Отримання</dt>
          <dd>
            {deliveryMethodLabel[order.deliveryMethod] ?? order.deliveryMethod}
            {where && `: ${where}`}
          </dd>
          <dt>Покупець</dt>
          <dd>
            {order.customer.name}, {order.customer.phone}
          </dd>
        </dl>
      </header>

      <div className="checkout" style={{ paddingTop: "var(--space-2xl)" }}>
        <div className="checkout__form">
          {order.canPay &&
            (returnedFromPayment && order.paymentStatus === "pending" ? (
              <PaymentPending />
            ) : (
              <PayButton number={order.number} token={token} failed={order.paymentStatus === "failed"} amount={formatMoney(order.total)} />
            ))}
          <section aria-labelledby="items-title">
            <h2 id="items-title">Склад замовлення</h2>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {order.items.map((item) => (
                <li key={item.productId} className="line">
                  <span className="line__photo">{item.imageUrl && <img src={thumb(item.imageUrl)} alt="" width={56} height={56} loading="lazy" />}</span>
                  <div>
                    <p className="line__name">
                      <Link href={`/product/${item.slug}`}>{item.name}</Link>
                    </p>
                    <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                      <span className="code" translate="no">{item.sku}</span>, {item.quantity} шт. по {formatMoney(item.unitPrice)}
                    </p>
                  </div>
                  <p className="line__total">{formatMoney(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="totals" style={{ marginTop: "var(--space-lg)" }}>
              <dt>Товари</dt>
              <dd>{formatMoney(order.subtotal)}</dd>
              <dt>Доставка</dt>
              <dd>{order.deliveryMethod === "pickup" ? "безкоштовно" : "за тарифами перевізника"}</dd>
              {Number(order.refundedAmount.value) > 0 && (
                <>
                  <dt>Повернено</dt>
                  <dd>{formatMoney(order.refundedAmount)}</dd>
                </>
              )}
              <dt className="grand">Разом</dt>
              <dd className="grand">{formatMoney(order.total)}</dd>
            </dl>
          </section>

          {receipts && receipts.length > 0 && (
            <section aria-labelledby="receipts-title">
              <h2 id="receipts-title">Чеки</h2>
              <ul className="receipts">
                {receipts.map((r) => (
                  <li key={r.id}>
                    <span>
                      {receiptKindLabel[r.kind] ?? r.kind}, {formatMoney(r.amount)}
                      <br />
                      <span className="muted">
                        Фіскальний номер <span className="code">{r.fiscalCode}</span>
                      </span>
                    </span>
                    {r.url && (
                      <a className="link" href={r.url} target="_blank" rel="noopener">
                        Відкрити чек
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="summary" aria-labelledby="history-title">
          <h2 id="history-title">Історія</h2>
          <ol className="timeline">
            {[...order.history].reverse().map((h, i) => (
              <li key={`${h.status}-${i}`}>
                <span>{orderStatusLabel[h.status]}</span>
                <time dateTime={h.at}>{formatDateTime(h.at)}</time>
              </li>
            ))}
          </ol>
          <p className="field__help">
            Створено {formatDateTime(order.createdAt)}. Продавець: {order.sellerName}.
          </p>
          <Link href="/catalog" className="btn btn--quiet">
            Повернутися до каталогу
          </Link>
        </aside>
      </div>
    </>
  );
}
