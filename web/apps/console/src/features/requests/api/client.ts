import type { CsrfHeaders } from "@/shared/csrf";
import { browserApi } from "@polivalko/shared/api/browser";
import type { components, paths } from "@polivalko/shared/api/schema";

type RequestsQuery = NonNullable<paths["/api/v1/console/service-requests"]["get"]["parameters"]["query"]>;

export function getServiceRequests(query: RequestsQuery) {
  return browserApi.GET("/api/v1/console/service-requests", { params: { query } });
}

export function changeServiceRequestStatus(headers: CsrfHeaders, id: string, body: components["schemas"]["ChangeServiceRequestStatusRequest"]) {
  return browserApi.POST("/api/v1/console/service-requests/{id}/status", { params: { path: { id } }, headers, body });
}
