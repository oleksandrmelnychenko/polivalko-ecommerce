import { browserApi } from "@polivalko/shared/api/browser";
import { problemOf } from "@polivalko/shared/api/problem";
import { withActiveSession } from "./session-store";

let csrfToken: Promise<string> | null = null;

export type CsrfHeaders = { "X-CSRF-TOKEN": string };

function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const request = browserApi.GET("/api/v1/account/csrf", { cache: "no-store" }).then(({ data, response }) => {
    if (!response.ok || !data?.token) throw new Error("Не вдалося отримати захисний токен.");
    return data.token;
  });
  csrfToken = request;
  void request.catch(() => {
    if (csrfToken === request) forgetCsrf();
  });
  return request;
}

export function forgetCsrf() {
  csrfToken = null;
}

export async function withCsrf<R extends { error?: unknown }>(send: (headers: CsrfHeaders) => Promise<R>): Promise<R> {
  const request = getCsrfToken();
  let result = await send({ "X-CSRF-TOKEN": await request });
  if (problemOf(result)?.code === "auth.csrf_invalid") {
    if (csrfToken === request) forgetCsrf();
    result = await send({ "X-CSRF-TOKEN": await getCsrfToken() });
  }
  return result;
}

export function withAccountCsrf<R extends { error?: unknown; response: Response }>(send: (headers: CsrfHeaders) => Promise<R>, owner?: string | null): Promise<R> {
  return withActiveSession((assertActive) => withCsrf((headers) => {
    assertActive();
    return send(headers);
  }), owner);
}
