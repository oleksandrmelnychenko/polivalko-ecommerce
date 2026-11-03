import { browserApi } from "@/shared/api/browser";

export function getSummary() {
  return browserApi.GET("/api/v1/admin/summary");
}

export function getNewOrders() {
  return browserApi.GET("/api/v1/admin/orders", { params: { query: { status: "new", page: 1, pageSize: 3 } } });
}

export function search(q: string) {
  return browserApi.GET("/api/v1/admin/search", { params: { query: { q } } });
}
