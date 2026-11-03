import type { CsrfHeaders } from "@/shared/admin/csrf";
import { browserApi } from "@/shared/api/browser";
import type { components, paths } from "@/shared/api/schema";

type RequestsQuery = NonNullable<paths["/api/v1/admin/service-requests"]["get"]["parameters"]["query"]>;

export function getServiceRequests(query: RequestsQuery) {
  return browserApi.GET("/api/v1/admin/service-requests", { params: { query } });
}

export function changeServiceRequestStatus(headers: CsrfHeaders, id: string, body: components["schemas"]["ChangeServiceRequestStatusRequest"]) {
  return browserApi.POST("/api/v1/admin/service-requests/{id}/status", { params: { path: { id } }, headers, body });
}
