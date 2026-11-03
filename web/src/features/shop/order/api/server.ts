import "server-only";
import { api } from "@/shared/api/server";

export function getOrderAndReceipts(number: string, token: string) {
  return Promise.all([
    api.GET("/api/v1/orders/{number}", { params: { path: { number }, query: { token } }, cache: "no-store" }),
    api.GET("/api/v1/orders/{number}/receipts", { params: { path: { number }, query: { token } }, cache: "no-store" }),
  ]);
}
