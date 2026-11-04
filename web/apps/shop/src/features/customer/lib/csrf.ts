import { browserApi } from "@polivalko/shared/api/browser";
import { problemOf } from "@polivalko/shared/api/problem";

let csrfToken: Promise<string> | null = null;

export type CsrfHeaders = { "X-CSRF-TOKEN": string };

export async function csrfHeader(): Promise<CsrfHeaders> {
  csrfToken ??= browserApi.GET("/api/v1/account/csrf").then(
    ({ data }) => data?.token ?? "",
    () => "",
  );
  return { "X-CSRF-TOKEN": await csrfToken };
}

export function forgetCsrf() {
  csrfToken = null;
}

export async function withCsrf<R extends { error?: unknown }>(send: (headers: CsrfHeaders) => Promise<R>): Promise<R> {
  let result = await send(await csrfHeader());
  if (problemOf(result)?.code === "auth.csrf_invalid") {
    forgetCsrf();
    result = await send(await csrfHeader());
  }
  return result;
}
