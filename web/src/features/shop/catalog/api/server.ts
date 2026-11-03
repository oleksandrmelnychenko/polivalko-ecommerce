import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { api } from "@/shared/api/server";

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

export async function searchProducts(query: ProductQuery) {
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
  const { data } = await api.GET("/api/v1/collections");
  return data ?? [];
}

export async function getSitemap() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "products", "categories");
  const { data } = await api.GET("/api/v1/catalog/sitemap");
  return data ?? { categories: [], products: [] };
}

export async function resolveRedirect(path: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("redirects");
  const { data } = await api.GET("/api/v1/redirects/resolve", { params: { query: { path } } });
  return data?.to ?? null;
}
