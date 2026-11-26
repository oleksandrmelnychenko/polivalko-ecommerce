import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { api } from "@polivalko/shared/api/server";
import { loaded } from "@/shared/lib/api-result";

export async function getCategoryTree() {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "categories");
  const { data } = await api.GET("/api/v1/categories");
  if (!data) throw new Error("API: не вдалося завантажити категорії");
  return data;
}

export async function getCategory(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "categories", `category:${slug}`);
  const { data, response } = await api.GET("/api/v1/categories/{slug}", { params: { path: { slug } } });
  if (response.status === 404) return null;
  if (!data) throw new Error(`API: не вдалося завантажити категорію ${slug}`);
  return data;
}

export type ProductQuery = {
  q?: string;
  category?: string;
  brand?: string;
  inStock?: boolean;
  onSale?: boolean;
  priceMin?: number;
  priceMax?: number;
  f?: string[];
  sort?: string;
  page?: number;
  pageSize?: number;
};

export const PAGE_SIZE = 24;

const kyivDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date());

// The mode changes only when the console saves it (the API then invalidates the "catalog" tag) or when a mode
// saved "through" a date ends at Kyiv midnight, which the day in the cache key covers. Fetching it uncached
// cost every listing view one more API round trip (~40 ms of the ~190 ms to the first product tile).
async function storefrontMode(day: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "storefront-mode", `storefront-mode:${day}`);
  const { data } = await api.GET("/api/v1/catalog/storefront-mode");
  if (!data) throw new Error("Не вдалося завантажити режим вітрини");
  return data.mode + "/" + data.revision;
}

// connection(): reading the clock during a prerender fails the route, and these listings were request-time
// already (the lookup used to be uncached), so the render stays as dynamic as before, minus the API call.
const currentMode = cache(async () => {
  await connection();
  return storefrontMode(kyivDay());
});

export async function searchProducts(query: ProductQuery) {
  return searchSortedProducts({ query, modeRevision: query.sort ? undefined : await currentMode() });
}

/** How many products are on sale now, by the query the menu uses to show «Акції»; null when the catalog did not answer. */
export async function countSaleProducts(): Promise<number | null> {
  return searchProducts({ onSale: true, sort: "price_asc", pageSize: 1 }).then((result) => result?.totalItems ?? null, () => null);
}

// Include the effective mode and revision in the cache key, including after a scheduled expiry.
async function searchSortedProducts({ query }: { query: ProductQuery; modeRevision?: string }) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "products");
  const { data, response } = await api.GET("/api/v1/products", {
    params: { query: { pageSize: PAGE_SIZE, ...query } },
  });
  if (response.status === 404 || response.status === 400) return null;
  if (!data) throw new Error("API: не вдалося завантажити товари");
  return data;
}

export async function getCollections() {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "collections");
  return loaded(await api.GET("/api/v1/collections"), "колекції") ?? [];
}

export async function getSitemap() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "products", "categories");
  const data = loaded(await api.GET("/api/v1/catalog/sitemap"), "карту сайту");
  if (!data) throw new Error("API: не вдалося завантажити карту сайту");
  return data;
}

/** Products for the feed a shopping service fetches; it throws when the catalog does not answer. */
export async function getMerchantFeed() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "products", "categories");
  const data = loaded(await api.GET("/api/v1/catalog/merchant-feed"), "товарний фід");
  if (!data) throw new Error("API: не вдалося завантажити товарний фід");
  return data;
}

export async function resolveRedirect(path: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("redirects");
  return loaded(await api.GET("/api/v1/redirects/resolve", { params: { query: { path } } }), "перенаправлення")?.to ?? null;
}

export async function getBestsellers(take: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "products", "bestsellers");
  return loaded(await api.GET("/api/v1/bestsellers", { params: { query: { take } } }), "хіти продажів");
}
