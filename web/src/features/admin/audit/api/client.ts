import { browserApi } from "@/shared/api/browser";
import type { paths } from "@/shared/api/schema";

type AuditQuery = NonNullable<paths["/api/v1/console/audit"]["get"]["parameters"]["query"]>;

export function getAudit(query: AuditQuery) {
  return browserApi.GET("/api/v1/console/audit", { params: { query } });
}
