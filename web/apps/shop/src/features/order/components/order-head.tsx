import type { Order } from "@polivalko/shared/api/types";
import { deliveryMethodLabel, orderStatusLabel, paymentMethodLabel, paymentStatusLabel } from "@polivalko/shared/lib/labels";

export function OrderHead({ order, heading, where }: { order: Order; heading: string; where: string }) {
  return (
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
  );
}
