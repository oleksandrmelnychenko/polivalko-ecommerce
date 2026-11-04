"use client";

import { isOrderPaid } from "@/features/order";
import { PayButton, PaymentPending } from "@/features/payment";
import { withCsrf } from "@/features/customer";
import type { Order } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { postOrderPayment } from "../api/client";

export function OrderPayment({ order, returned, reload }: { order: Order; returned: boolean; reload: () => void }) {
  if (returned && isOrderPaid(order))
    return (
      <p className="notice notice--ok" role="status">
        <strong>Оплату отримано</strong>
        Дякуємо! Статус замовлення оновиться, щойно менеджер його опрацює.
      </p>
    );
  if (!order.canPay) return null;
  if (returned && order.paymentStatus === "pending") return <PaymentPending onRefresh={reload} />;
  return (
    <PayButton
      number={order.number}
      failed={order.paymentStatus === "failed"}
      amount={formatMoney(order.total)}
      start={() => withCsrf((h) => postOrderPayment(h, order.number))}
    />
  );
}
