import { browserApi } from "@polivalko/shared/api/browser";

export function getSettlements(q: string, signal: AbortSignal) {
  return browserApi.GET("/api/v1/delivery/np/settlements", { params: { query: q ? { q } : {} }, signal });
}

export function getWarehouses(settlementRef: string, signal: AbortSignal) {
  return browserApi.GET("/api/v1/delivery/np/warehouses", { params: { query: { settlementRef } }, signal });
}
