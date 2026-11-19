import type { CreateOrderRequest } from "@polivalko/shared/api/types";

export function validateOrder(request: CreateOrderRequest) {
  const errors: Record<string, string> = {};
  const nameValid = (value: string | null | undefined) => Boolean(value && value.trim().length >= 2 && value.trim().length <= 100 && !/[\u0000-\u001f]/.test(value));
  const phoneValid = (value: string | null | undefined) => /^(?:\+?38)?0\d{9}$/.test((value ?? "").replace(/[\s()\-]/g, ""));
  if (!nameValid(request.customer?.name)) errors["customer.name"] = "Вкажіть ім’я та прізвище (від 2 до 100 символів).";
  if (!phoneValid(request.customer?.phone)) errors["customer.phone"] = "Вкажіть український номер телефону.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.customer?.email ?? "")) errors["customer.email"] = "Вкажіть коректний email.";
  if (request.recipient) {
    if (!nameValid(request.recipient.name)) errors["recipient.name"] = "Вкажіть ім’я та прізвище отримувача.";
    if (!phoneValid(request.recipient.phone)) errors["recipient.phone"] = "Вкажіть український номер телефону отримувача.";
  }
  const delivery = request.delivery;
  if (!delivery?.method) errors["delivery.method"] = "Оберіть спосіб отримання.";
  if (delivery?.method === "nova_poshta" || delivery?.method === "nova_poshta_courier") {
    if (!delivery.settlementRef) errors["delivery.settlementRef"] = "Оберіть населений пункт зі списку.";
    if (delivery.method === "nova_poshta" && !delivery.warehouseRef) errors["delivery.warehouseRef"] = "Оберіть відділення або поштомат.";
    if (delivery.method === "nova_poshta_courier") {
      if (!delivery.address?.street?.trim()) errors["delivery.address.street"] = "Вкажіть вулицю.";
      if (!delivery.address?.house?.trim()) errors["delivery.address.house"] = "Вкажіть номер будинку.";
    }
  }
  if (!request.payment?.method) errors["payment.method"] = "Оберіть спосіб оплати.";
  if ((request.comment?.length ?? 0) > 1000) errors.comment = "Коментар має бути не довшим за 1000 символів.";
  if (!request.acceptOffer) errors.acceptOffer = "Підтвердіть згоду з умовами публічної оферти.";
  return errors;
}
