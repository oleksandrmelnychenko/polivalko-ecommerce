import type { OrderStatus, PaymentStatus } from "@/shared/api/types";

export const orderStatusLabel: Record<OrderStatus, string> = {
  new: "Нове",
  awaitingConfirmation: "Чекає підтвердження",
  confirmed: "Підтверджене",
  awaitingPayment: "Чекає оплати",
  paid: "Оплачене",
  shipped: "Відправлене",
  readyForPickup: "Готове до видачі",
  completed: "Виконане",
  cancelled: "Скасоване",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  notRequired: "Оплата під час отримання",
  pending: "Чекає оплати",
  succeeded: "Оплачено",
  failed: "Оплата не пройшла",
  partiallyRefunded: "Частково повернено",
  refunded: "Кошти повернено",
};

export const paymentMethodLabel: Record<string, string> = {
  card: "Карткою онлайн",
  cash_on_delivery: "Післяплата",
  pay_on_pickup: "У магазині під час самовивозу",
};

export const deliveryMethodLabel: Record<string, string> = {
  nova_poshta: "Нова пошта",
  nova_poshta_courier: "Кур'єр Нової пошти",
  pickup: "Самовивіз у Бучі",
};

export const serviceRequestStatusLabel: Record<string, string> = {
  new: "Нова",
  inProgress: "В роботі",
  done: "Виконана",
};

export const refundStatusLabel: Record<string, string> = {
  pending: "Обробляється",
  succeeded: "Виконано",
  failed: "Не виконано",
};

export const receiptKindLabel: Record<string, string> = {
  sell: "Чек продажу",
  return: "Чек повернення",
};
