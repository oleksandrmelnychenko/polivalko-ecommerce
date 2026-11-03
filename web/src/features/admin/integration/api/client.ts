import type { CsrfHeaders } from "@/shared/admin/csrf";
import { browserApi } from "@/shared/api/browser";

export function getIntegrationStatus() {
  return browserApi.GET("/api/v1/admin/integration/status");
}

export function runJob(headers: CsrfHeaders, job: string) {
  return browserApi.POST("/api/v1/admin/integration/jobs/{job}/run", { params: { path: { job } }, headers });
}

export function getRuns(job: string | undefined) {
  return browserApi.GET("/api/v1/admin/integration/runs", { params: { query: { job } } });
}

export function getOutbox() {
  return browserApi.GET("/api/v1/admin/integration/outbox");
}

export function retryOutbox(headers: CsrfHeaders, id: string) {
  return browserApi.POST("/api/v1/admin/integration/outbox/{id}/retry", { params: { path: { id } }, headers });
}

export function getNovaPoshta() {
  return browserApi.GET("/api/v1/admin/delivery/novaposhta");
}
