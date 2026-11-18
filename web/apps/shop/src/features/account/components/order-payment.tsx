"use client";

import { PayButton, PaymentPending } from "@/features/payment";
import { withCsrf } from "@/features/customer";
import type { Order, OrderStatus } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { postOrderPayment } from "../api/client";

const BEFORE_HANDOVER: OrderStatus[] = ["new", "awaitingConfirmation", "confirmed", "awaitingPayment", "paid"];

export function OrderPayment({ order, returned, reload }: { order: Order; returned: boolean; reload: () => void }) {
  if (returned && order.paymentStatus === "succeeded" && BEFORE_HANDOVER.includes(order.status))
    return (
      <p className="notice notice--ok" role="status">
        <strong>Оплату отримано</strong>
        Дякуємо. Статус замовлення оновиться, коли менеджер його опрацює.
      </p>
    );
  if (!order.canPay) return null;
  const payButton = (
    <PayButton
      number={order.number}
      failed={order.paymentStatus === "failed"}
      amount={formatMoney(order.total)}
      start={() => withCsrf((h) => postOrderPayment(h, order.number))}
    />
  );
  if (returned && order.paymentStatus === "pending") return <PaymentPending onRefresh={reload}>{payButton}</PaymentPending>;
  return payButton;
}
