import type { CsrfHeaders } from "@/shared/admin/csrf";
import { downloadFile } from "@/shared/admin/download";
import { browserApi } from "@/shared/api/browser";
import type { components, paths } from "@/shared/api/schema";

type OrdersQuery = NonNullable<paths["/api/v1/admin/orders"]["get"]["parameters"]["query"]>;
type CountsQuery = NonNullable<paths["/api/v1/admin/orders/counts"]["get"]["parameters"]["query"]>;

export function getOrders(query: OrdersQuery) {
  return browserApi.GET("/api/v1/admin/orders", { params: { query } });
}

export function getOrderCounts(query: CountsQuery) {
  return browserApi.GET("/api/v1/admin/orders/counts", { params: { query } });
}

export function exportOrders(search: URLSearchParams) {
  return downloadFile(`/api/v1/admin/orders/export${search.size ? `?${search}` : ""}`, "polivalko-orders.csv");
}

export function getOrder(number: string) {
  return browserApi.GET("/api/v1/admin/orders/{number}", { params: { path: { number } } });
}

export function changeOrderStatus(headers: CsrfHeaders, number: string, body: components["schemas"]["ChangeOrderStatusRequest"]) {
  return browserApi.POST("/api/v1/admin/orders/{number}/status", { params: { path: { number } }, headers, body });
}

export function createRefund(headers: CsrfHeaders, number: string, idempotencyKey: string, body: components["schemas"]["CreateRefundRequest"]) {
  return browserApi.POST("/api/v1/admin/orders/{number}/refunds", {
    params: { path: { number }, header: { "Idempotency-Key": idempotencyKey } },
    headers,
    body,
  });
}

export function getOrderPayments(number: string) {
  return browserApi.GET("/api/v1/admin/orders/{number}/payments", { params: { path: { number } } });
}

export function getOrderReceipts(number: string) {
  return browserApi.GET("/api/v1/admin/orders/{number}/receipts", { params: { path: { number } } });
}
