import type { components } from "@polivalko/shared/api/schema";

export type Dashboard = components["schemas"]["ConsoleDashboardDto"];
export type Summary = components["schemas"]["ConsoleSummaryDto"];
export type Metric = "revenue" | "orders";
