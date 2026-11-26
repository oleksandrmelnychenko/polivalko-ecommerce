import { browserApi } from "@polivalko/shared/api/browser";

export function startPayment(number: string, token: string, idempotencyKey: string, method?: string | null) {
  return browserApi.POST("/api/v1/orders/{number}/payments", {
    params: { path: { number }, header: { "Idempotency-Key": idempotencyKey } },
    body: { token, method: method ?? null },
  });
}

/** Banks and wallets the buyer can pay with: monobank, PrivatBank (LiqPay), Apple Pay / Google Pay. */
export function getPaymentOptions(signal: AbortSignal) {
  return browserApi.GET("/api/v1/payments/options", { cache: "no-store", signal });
}

export function getSandboxInvoice(id: string, signal: AbortSignal) {
  return browserApi.GET("/api/v1/payments/sandbox/{invoiceId}", {
    params: { path: { invoiceId: id } },
    cache: "no-store",
    signal,
  });
}

export function completeSandboxInvoice(id: string, outcome: "success" | "failure" | "expired", notify: boolean) {
  return browserApi.POST("/api/v1/payments/sandbox/{invoiceId}/complete", {
    params: { path: { invoiceId: id } },
    body: { outcome, notify },
  });
}
