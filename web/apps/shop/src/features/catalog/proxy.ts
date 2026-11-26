import { NextResponse, type NextRequest } from "next/server";
import { apiInternalUrl } from "@polivalko/shared/api/origin";
import { first } from "@polivalko/shared/lib/format";
import { hrefFor, parseListingParams, toQuery, type SearchParams } from "./lib/listing-params";

/**
 * A listing page past the last one (an old link, fewer products now) answers a 307 to the last page,
 * before the prebuilt shell can answer 200. src/proxy.ts calls it for document requests to /catalog, /catalog/<slug>,
 * /brands/<slug>, /sale and /search; undefined lets the page render. Only pages after the first pay for the extra API request.
 */
export async function redirectPastLastPage(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const sp: SearchParams = Object.fromEntries(Array.from(new Set(searchParams.keys()), (key) => [key, searchParams.getAll(key)]));
  const parsed = parseListingParams(sp, pathname);
  if (parsed.page <= 1) return undefined;

  // The same base and fixed parameters as the search and category screens, so the API sees the page's own query.
  const search = pathname === "/search";
  const q = first(sp.q)?.trim() ?? "";
  if (search && !q) return undefined;
  const [, section, slug] = pathname.split("/");
  const segment = slug ? safeDecode(slug) : undefined;
  const base = search ? { q } : pathname === "/sale" ? { onSale: true } : section === "brands" ? { brandPage: segment } : { category: segment };

  const totalPages = await countPages(toQuery(base, parsed));
  if (totalPages === undefined) return undefined;
  const lastPage = Math.max(totalPages, 1);
  if (parsed.page <= lastPage) return undefined;
  return NextResponse.redirect(new URL(hrefFor(pathname, search ? { q } : {}, parsed, { page: lastPage }), request.url));
}

/** Undefined when the API fails or does not answer in time: the page then renders and decides on its own. */
async function countPages(query: ReturnType<typeof toQuery>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) qs.append(key, String(v));
  }
  try {
    const response = await fetch(`${apiInternalUrl}/api/v1/products?${qs}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      await response.body?.cancel();
      return undefined;
    }
    const data = (await response.json()) as { totalPages?: number };
    return typeof data.totalPages === "number" && Number.isInteger(data.totalPages) && data.totalPages >= 0 ? data.totalPages : undefined;
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
