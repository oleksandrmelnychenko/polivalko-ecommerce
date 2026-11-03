import { browserApi } from "@/shared/api/browser";

export function getDashboard(days: number) {
  return browserApi.GET("/api/v1/admin/dashboard", { params: { query: { days } } });
}

export function getLatestOrders() {
  return browserApi.GET("/api/v1/admin/orders", { params: { query: { page: 1, pageSize: 6 } } });
}
