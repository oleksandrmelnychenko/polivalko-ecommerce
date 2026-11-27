import { NextResponse, type NextRequest } from "next/server";
import { redirectPastLastPage } from "@/features/catalog/proxy";
import { markStreamingMetadata } from "@/features/seo/proxy";

/**
 * Marks people on pages whose metadata is part of the prebuilt shell, so Next.js answers them with the shell at once
 * (features/seo/proxy.ts).
 *
 * Listing pages past the last one answer a 307 to the last page before the prebuilt shell can answer 200.
 * Order pages opt into blocking rendering (`unstable_paramMatching = { number: "blocking" }`, `instant = false`)
 * so `OrderScreen` answers a real 404 directly without an internal rewrite.
 * Client navigations and prefetches skip the listing check: they have no status to fix, and the pages handle
 * the same case themselves.
 */
export async function proxy(request: NextRequest) {
  if (isClientFetch(request)) return NextResponse.next();
  const { pathname } = request.nextUrl;
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
    { source: "/catalog", has: [{ type: "query", key: "page" }] },
    { source: "/catalog/:slug", has: [{ type: "query", key: "page" }] },
    { source: "/brands/:slug", has: [{ type: "query", key: "page" }] },
    { source: "/sale", has: [{ type: "query", key: "page" }] },
    { source: "/search", has: [{ type: "query", key: "page" }] },
    "/",
    "/about",
    "/contacts",
    "/blog",
    "/blog/:slug",
    "/services",
  ],
};
