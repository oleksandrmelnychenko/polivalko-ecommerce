import { browserApi } from "@/shared/api/browser";
import type { CreateOrderRequest } from "@/shared/api/types";

export function getSettlements(q: string) {
  return browserApi.GET("/api/v1/delivery/np/settlements", { params: { query: q ? { q } : {} } });
}

export function getWarehouses(settlementRef: string) {
  return browserApi.GET("/api/v1/delivery/np/warehouses", { params: { query: { settlementRef } } });
}

export function createOrder(idempotencyKey: string, body: CreateOrderRequest) {
  return browserApi.POST("/api/v1/orders", {
    params: { header: { "Idempotency-Key": idempotencyKey } },
    body,
  });
}
