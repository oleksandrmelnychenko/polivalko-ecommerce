import type { CreateOrderRequest, Quote, Settlement } from "@/shared/api/types";

export function orderRequest(
  form: FormData,
  {
    items,
    quote,
    delivery,
    settlement,
    warehouseRef,
    payment,
  }: {
    items: { productId: string; quantity: number }[];
    quote: Quote;
    delivery: string;
    settlement: Settlement | null;
    warehouseRef: string;
    payment: string;
  },
): CreateOrderRequest {
  const novaPoshta = delivery === "nova_poshta" || delivery === "nova_poshta_courier";
  return {
    items,
    expectedTotal: quote.total.value,
    customer: {
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? "") || null,
    },
    delivery: {
      method: delivery,
      settlementRef: novaPoshta ? (settlement?.ref ?? null) : null,
      warehouseRef: delivery === "nova_poshta" ? warehouseRef || null : null,
      address:
        delivery === "nova_poshta_courier"
          ? {
              street: String(form.get("street") ?? ""),
              house: String(form.get("house") ?? ""),
              apartment: String(form.get("apartment") ?? "") || null,
            }
          : null,
    },
    payment: { method: payment },
    comment: String(form.get("comment") ?? "") || null,
    acceptOffer: form.get("acceptOffer") === "on",
  };
}
