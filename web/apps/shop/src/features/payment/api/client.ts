import { browserApi } from "@polivalko/shared/api/browser";

export function startPayment(number: string, token: string, idempotencyKey: string) {
  return browserApi.POST("/api/v1/orders/{number}/payments", {
    params: { path: { number }, header: { "Idempotency-Key": idempotencyKey } },
    body: { token },
  });
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
