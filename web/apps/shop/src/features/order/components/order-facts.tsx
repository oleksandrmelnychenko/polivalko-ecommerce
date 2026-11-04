import type { Order } from "@polivalko/shared/api/types";
import { deliveryMethodLabel, orderStatusLabel, paymentMethodLabel, paymentStatusLabel } from "@polivalko/shared/lib/labels";

export function OrderFacts({ order, where }: { order: Order; where: string }) {
  return (
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
  );
}
