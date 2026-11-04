import type { OrderStatus } from "@polivalko/shared/api/types";

export function orderTone(status: OrderStatus): "ok" | "bad" | "wait" {
  if (status === "cancelled") return "bad";
  if (status === "paid" || status === "shipped" || status === "readyForPickup" || status === "completed") return "ok";
  return "wait";
}
