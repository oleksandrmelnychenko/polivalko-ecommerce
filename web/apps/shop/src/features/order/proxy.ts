import { NextResponse, type NextRequest } from "next/server";
import { apiInternalUrl } from "@polivalko/shared/api/origin";

const ORDER_NUMBER = /^[A-Za-z0-9-]{1,32}$/;

/**
 * An order page depends on the token in its URL, so no static render can decide its status.
 * src/proxy.ts calls this for document requests to /order/<number>: without a matching order and token
 * the answer is a real 404; undefined lets the page render.
 */
export async function orderNotFound(request: NextRequest) {
  const number = request.nextUrl.pathname.split("/")[2] ?? "";
  const token = request.nextUrl.searchParams.get("token");
  if (ORDER_NUMBER.test(number) && token && (await orderMayExist(number, token))) return undefined;

  // An unmatched internal path renders app/not-found.tsx with status 404; the address bar keeps the order URL.
  return NextResponse.rewrite(new URL("/_not-found", request.url));
}

/** Only a definite "no such order for this token" closes the page; an API failure leaves it to the page itself. */
async function orderMayExist(number: string, token: string) {
  try {
    const url = `${apiInternalUrl}/api/v1/orders/${number}?token=${encodeURIComponent(token)}`;
    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
    await response.body?.cancel();
    return ![400, 401, 403, 404].includes(response.status);
  } catch {
    return true;
  }
}
