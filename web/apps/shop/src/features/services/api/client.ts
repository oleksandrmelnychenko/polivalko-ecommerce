import { browserApi } from "@polivalko/shared/api/browser";
import type { CreateServiceRequest } from "@polivalko/shared/api/types";

export function createServiceRequest(idempotencyKey: string, body: CreateServiceRequest) {
  return browserApi.POST("/api/v1/service-requests", {
    params: { header: { "Idempotency-Key": idempotencyKey } },
    body,
  });
}
