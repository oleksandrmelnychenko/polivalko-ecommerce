import "server-only";
import createClient from "openapi-fetch";
import { apiInternalUrl } from "./origin";
import type { paths } from "./schema";

export const api = createClient<paths>({
  baseUrl: apiInternalUrl,
});
