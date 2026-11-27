import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
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
  /** Slug of a brand page: its products in any spelling of the brand. */
  brandPage?: string;
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

// The mode changes when the console saves it (invalidating the "catalog" / "storefront-mode" tags) or when a
// scheduled mode ends; cacheLife("minutes") revalidates every 60 seconds without forcing dynamic connection().
async function storefrontMode() {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "storefront-mode");
  const { data } = await api.GET("/api/v1/catalog/storefront-mode");
  if (!data) throw new Error("Не вдалося завантажити режим вітрини");
  return data.mode + "/" + data.revision;
}

const currentMode = cache(() => storefrontMode());

export async function searchProducts(query: ProductQuery) {
  return searchSortedProducts({ query, modeRevision: query.sort ? undefined : await currentMode() });
}

/**
 * The total and the facets of a query, without its products. The order does not change either, so an explicit cheap
 * one spares the API the storefront mode and the seasonal ranking, the costliest part of a default listing.
 */
export async function summarizeProducts(query: Omit<ProductQuery, "sort" | "page" | "pageSize">) {
  return searchProducts({ ...query, sort: "price_asc", pageSize: 1 });
}

/** How many products are on sale now, by the query the menu uses to show «Акції»; null when the catalog did not answer. */
export async function countSaleProducts(): Promise<number | null> {
  return summarizeProducts({ onSale: true }).then((result) => result?.totalItems ?? null, () => null);
}

// Include the effective mode and revision in the cache key, including after a scheduled expiry.
async function searchSortedProducts({ query }: { query: ProductQuery; modeRevision?: string }) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "products", "stock");
  const { data, response } = await api.GET("/api/v1/products", {
    params: { query: { pageSize: PAGE_SIZE, ...query } },
  });
  if (response.status === 404 || response.status === 400) return null;
  if (!data) throw new Error("API: не вдалося завантажити товари");
  return data;
}

export async function getBrandPages() {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "products", "brands");
  return loaded(await api.GET("/api/v1/catalog/brands"), "бренди") ?? [];
}

/** A brand with its own page; null when it has none (fewer than five products with a photo, or no such brand). */
export async function getBrandPage(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "products", "brands", `brand:${slug}`);
  const { data, response } = await api.GET("/api/v1/catalog/brands/{slug}", { params: { path: { slug } } });
  if (response.status === 404) return null;
  if (!data) throw new Error(`API: не вдалося завантажити бренд ${slug}`);
  return data;
}

export async function getCollections() {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "collections", "stock");
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
  cacheTag("catalog", "products", "categories", "stock");
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
  cacheTag("catalog", "products", "bestsellers", "stock");
  return loaded(await api.GET("/api/v1/bestsellers", { params: { query: { take } } }), "хіти продажів");
}
