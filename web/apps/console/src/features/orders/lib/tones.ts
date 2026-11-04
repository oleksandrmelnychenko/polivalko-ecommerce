import type { OrderRow } from "./types";

export const statusTone: Record<OrderRow["status"], string> = {
  new: "yellow",
  awaitingConfirmation: "yellow",
  confirmed: "cyan",
  awaitingPayment: "cyan",
  paid: "green",
  shipped: "dark",
  readyForPickup: "green",
  completed: "grey",
  cancelled: "pink",
};

export const paymentTone: Record<OrderRow["paymentStatus"], string> = {
  notRequired: "outline",
  pending: "cyan",
  succeeded: "green",
  failed: "pink",
  partiallyRefunded: "yellow",
  refunded: "grey",
};

export const attemptLabel: Record<string, string> = {
  created: "Створено",
  processing: "Обробляється",
  succeeded: "Успішно",
  failed: "Відмова",
  expired: "Прострочено",
  reversed: "Повернено",
};
