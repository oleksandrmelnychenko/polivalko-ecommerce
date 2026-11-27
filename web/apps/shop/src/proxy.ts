import { NextResponse, type NextRequest } from "next/server";
import { redirectPastLastPage } from "@/features/catalog/proxy";
import { orderNotFound } from "@/features/order/proxy";
import { markStreamingMetadata } from "@/features/seo/proxy";

/**
 * Marks people on pages whose metadata is part of the prebuilt shell, so Next.js answers them with the shell at once
 * (features/seo/proxy.ts).
 *
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
  if (pathname.startsWith("/order/")) return (await orderNotFound(request)) ?? NextResponse.next();
  if (LISTINGS.some((path) => path.test(pathname))) return (await redirectPastLastPage(request)) ?? NextResponse.next();
  // A person on a page whose metadata is in its shell gets the shell at once (see shared/lib/streaming-metadata.ts).
  return markStreamingMetadata(request) ?? NextResponse.next();
}

const LISTINGS = [/^\/catalog(\/[^/]+)?$/, /^\/brands\/[^/]+$/, /^\/sale$/, /^\/search$/];

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
  matcher: [
    "/order/:number", "/catalog", "/catalog/:slug", "/brands/:slug", "/sale", "/search",
    "/", "/about", "/contacts", "/blog", "/blog/:slug", "/services",
  ],
};
