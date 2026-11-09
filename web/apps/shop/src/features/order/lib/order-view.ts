import type { Order } from "@polivalko/shared/api/types";

export function orderWhere(order: Order): string {
  return order.deliveryMethod === "pickup"
    ? (order.delivery.pickupAddress ?? "")
    : [order.delivery.settlementName, order.delivery.warehouseName ?? order.delivery.address].filter(Boolean).join(", ");
}

export function isOrderPaid(order: Order): boolean {
  return order.paymentStatus === "succeeded" || order.paymentStatus === "partiallyRefunded" || order.paymentStatus === "refunded";
}

export function orderHeading(order: Order, paid: boolean): string {
  return order.status === "cancelled"
    ? "Замовлення скасоване"
    : order.status === "awaitingConfirmation"
      ? "Заявку прийнято"
      : paid
        ? "Замовлення оплачене"
        : "Дякуємо, замовлення прийнято";
}
