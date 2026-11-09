import type { Order } from "@polivalko/shared/api/types";
import { deliveryMethodLabel, orderStatusLabel, paymentMethodLabel, paymentStatusLabel } from "@polivalko/shared/lib/labels";

const PENDING_SELLER = /уточнюється/i;

export function OrderFacts({ order, where }: { order: Order; where: string }) {
  const rows = [
    { label: "Статус", value: orderStatusLabel[order.status], strong: true },
    { label: "Оплата", value: `${paymentMethodLabel[order.paymentMethod] ?? order.paymentMethod}, ${paymentStatusLabel[order.paymentStatus].toLowerCase()}` },
    { label: "Отримання", value: `${deliveryMethodLabel[order.deliveryMethod] ?? order.deliveryMethod}${where ? `: ${where}` : ""}` },
    { label: "Покупець", value: `${order.customer.name}, ${order.customer.phone}` },
    { label: "Продавець", value: PENDING_SELLER.test(order.sellerName) ? "" : order.sellerName },
  ].filter((row) => row.value);

  return (
    <section className="order-facts" aria-labelledby="order-facts-title">
      <h2 id="order-facts-title">Деталі</h2>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.strong ? <strong>{row.value}</strong> : row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
