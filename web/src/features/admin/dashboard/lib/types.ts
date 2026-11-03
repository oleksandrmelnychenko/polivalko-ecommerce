import type { components } from "@/shared/api/schema";

export type Dashboard = components["schemas"]["AdminDashboardDto"];
export type Summary = components["schemas"]["AdminSummaryDto"];
export type Metric = "revenue" | "orders";
