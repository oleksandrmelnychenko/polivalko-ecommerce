import { NextResponse, type NextRequest } from "next/server";
import { redirectPastLastPage } from "@/features/catalog/proxy";
import { orderNotFound } from "@/features/order/proxy";

/**
 * Some statuses depend on data from the request URL, and the prebuilt page shell would already answer 200.
 * For a document request the features decide them first:
 * - an order page without a matching order and token answers 404;
 * - a listing page past the last one answers a 307 to the last page.
 * Client navigations and prefetches skip the checks: they have no status to fix, and the pages handle
 * the same cases themselves.
 */
export async function proxy(request: NextRequest) {
  if (isClientFetch(request)) return NextResponse.next();
  const { pathname } = request.nextUrl;
  const answer = pathname.startsWith("/order/") ? await orderNotFound(request) : await redirectPastLastPage(request);
  return answer ?? NextResponse.next();
}

/**
 * Next.js strips its RSC headers and the _rsc parameter before the proxy runs, so a client navigation
 * is recognized by the browser's fetch metadata instead: it is a fetch, not a page navigation.
 * Clients that send no such header (curl, crawlers) count as document requests.
 */
function isClientFetch(request: NextRequest) {
  const mode = request.headers.get("sec-fetch-mode");
  return mode !== null && mode !== "navigate";
}

export const config = {
  matcher: ["/order/:number", "/catalog/:slug", "/search"],
};
