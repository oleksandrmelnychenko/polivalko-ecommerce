import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

/** Клієнт для браузера: той самий origin, запит іде на /api/v1 (через Caddy або rewrites у dev). */
export const browserApi = createClient<paths>({ baseUrl: "" });

type S = components["schemas"];
export type CreateServiceRequest = S["CreateServiceRequest"];
export type Quote = S["QuoteDto"];
export type QuoteLine = S["QuoteLineDto"];
export type CreateOrderRequest = S["CreateOrderRequest"];
export type Settlement = S["SettlementDto"];
export type Warehouse = S["WarehouseDto"];

/** Тіло помилки API (RFC 9457) з машинозчитуваним кодом і розширеннями. */
export type Problem = {
  title?: string;
  detail?: string;
  code?: string;
  errors?: Record<string, string[]>;
  [extension: string]: unknown;
};

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
