import { browserApi } from "@/shared/api/browser";
import { problemOf } from "@/shared/api/problem";

let csrfToken: string | null = null;

export async function csrfHeader(): Promise<{ "X-CSRF-TOKEN": string }> {
  if (!csrfToken) {
    const { data } = await browserApi.GET("/api/v1/console/auth/csrf");
    csrfToken = data?.token ?? "";
  }
  return { "X-CSRF-TOKEN": csrfToken };
}

export function forgetCsrf() {
  csrfToken = null;
}

export type CsrfHeaders = Awaited<ReturnType<typeof csrfHeader>>;

export async function withCsrf<R extends { error?: unknown }>(send: (headers: CsrfHeaders) => Promise<R>): Promise<R> {
  let result = await send(await csrfHeader());
  if (problemOf(result)?.code === "auth.csrf_invalid") {
    forgetCsrf();
    result = await send(await csrfHeader());
  }
  return result;
}
