import createClient from "openapi-fetch";
import type { paths } from "./schema";

export const browserApi = createClient<paths>({ baseUrl: "" });

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
