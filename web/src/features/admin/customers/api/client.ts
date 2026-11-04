import { browserApi } from "@/shared/api/browser";
import type { paths } from "@/shared/api/schema";

type CustomersQuery = NonNullable<paths["/api/v1/console/customers"]["get"]["parameters"]["query"]>;

export function getCustomers(query: CustomersQuery) {
  return browserApi.GET("/api/v1/console/customers", { params: { query } });
}
