import { NextResponse, type NextRequest } from "next/server";
import { first } from "@polivalko/shared/lib/format";
import { hrefFor, parseListingParams, toQuery, type SearchParams } from "./lib/listing-params";

const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:5080";

/**
 * A listing page past the last one (an old link, fewer products now) answers a 307 to the last page,
 * before the prebuilt shell can answer 200. src/proxy.ts calls it for document requests to /catalog/<slug>
 * and /search; undefined lets the page render. Only pages after the first pay for the extra API request.
 */
export async function redirectPastLastPage(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const sp: SearchParams = {};
  for (const key of new Set(searchParams.keys())) sp[key] = searchParams.getAll(key);
  const parsed = parseListingParams(sp);
  if (parsed.page <= 1) return undefined;

  // The same base and fixed parameters as the search and category screens, so the API sees the page's own query.
  const search = pathname === "/search";
  const q = first(sp.q)?.trim() ?? "";
  if (search && !q) return undefined;
  const base = search ? { q } : { category: safeDecode(pathname.split("/")[2] ?? "") };

  const totalPages = await countPages(toQuery(base, parsed));
  if (!totalPages || parsed.page <= totalPages) return undefined;
  return NextResponse.redirect(new URL(hrefFor(pathname, search ? { q } : {}, parsed, { page: totalPages }), request.url));
}

/** Undefined when the API fails or does not answer in time: the page then renders and decides on its own. */
async function countPages(query: ReturnType<typeof toQuery>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) qs.append(key, String(v));
  }
  try {
    const response = await fetch(`${apiUrl}/api/v1/products?${qs}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { totalPages?: number };
    return data.totalPages;
  } catch {
    return undefined;
  }
}

function safeDecode(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
