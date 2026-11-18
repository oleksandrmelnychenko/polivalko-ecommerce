import type { Order, OrderStatus } from "@polivalko/shared/api/types";
import { orderStatusLabel, paymentStatusLabel } from "@polivalko/shared/lib/labels";

export type OrderStep = { key: string; label: string; at: string | null; state: "done" | "current" | "todo"; hint: string | null };

const STEP_HINT: Partial<Record<OrderStatus, string>> = {
  new: "Звіряємо ціну й залишок",
  awaitingConfirmation: "Звіряємо ціну й залишок",
  awaitingPayment: orderStatusLabel.awaitingPayment,
  paid: orderStatusLabel.paid,
};

export function orderWhere(order: Order): string {
  return order.deliveryMethod === "pickup"
    ? (order.delivery.pickupAddress ?? "")
    : [order.delivery.settlementName, order.delivery.warehouseName ?? order.delivery.address].filter(Boolean).join(", ");
}

export function isOrderPaid(order: Order): boolean {
  return order.paymentStatus === "succeeded" || order.paymentStatus === "partiallyRefunded" || order.paymentStatus === "refunded";
}

export function orderHeading(order: Order): string {
  if (order.status === "cancelled") return "Замовлення скасоване";
  if (order.paymentStatus === "refunded") return "Кошти за замовлення повернено";
  if (order.status === "completed") return "Замовлення виконане";
  if (order.status === "awaitingConfirmation") return "Заявку прийнято";
  if (order.status === "shipped") return "Замовлення відправлене";
  if (order.status === "readyForPickup") return "Замовлення готове до видачі";
  if (order.paymentStatus === "succeeded" || order.paymentStatus === "partiallyRefunded") return "Замовлення оплачене";
  return "Дякуємо, замовлення прийнято";
}

export function orderSteps(order: Order): OrderStep[] | null {
  if (order.status === "cancelled") return null;
  const pickup = order.deliveryMethod === "pickup";
  const plan: { key: string; label: string; statuses: OrderStatus[] }[] = [
    { key: "placed", label: "Прийнято", statuses: ["new", "awaitingConfirmation"] },
    { key: "confirmed", label: "Підтверджено", statuses: ["confirmed", "awaitingPayment", "paid"] },
    { key: "sent", label: pickup ? "Готове до видачі" : "Відправлено", statuses: ["shipped", "readyForPickup"] },
    { key: "done", label: pickup ? "Видано" : "Отримано", statuses: ["completed"] },
  ];
  const current = Math.max(
    0,
    plan.findIndex((step) => step.statuses.includes(order.status)),
  );
  const finished = order.status === "completed";
  return plan.map((step, i) => {
    const reached = order.history.filter((entry) => step.statuses.includes(entry.status)).map((entry) => entry.at);
    const at = i === 0 ? order.createdAt : (reached.sort()[0] ?? null);
    const state = i < current || (finished && i === current) ? "done" : i === current ? "current" : "todo";
    const hint = state !== "current" ? null : order.paymentStatus === "refunded" || order.paymentStatus === "partiallyRefunded" ? paymentStatusLabel[order.paymentStatus] : (STEP_HINT[order.status] ?? null);
    return { key: step.key, label: step.label, at: state === "todo" ? null : at, state, hint };
  });
}
