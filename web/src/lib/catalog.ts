import { cacheLife, cacheTag } from "next/cache";
import { api } from "./api/server";

// Дані каталогу кешуються з тегами. Після синхронізації з Navkolo або змін в адмінці
// Worker викликає /internal/revalidate з тегами змінених товарів, а cacheLife("minutes")
// служить страховкою.

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
  /** Характеристики у форматі "Назва:Значення". */
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

export async function getProduct(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "products", `product:${slug}`);
  const { data, response } = await api.GET("/api/v1/products/{slug}", { params: { path: { slug } } });
  if (response.status === 404) return null;
  if (!data) throw new Error(`API: не вдалося завантажити товар ${slug}`);
  return data;
}

export async function getServiceDirections() {
  "use cache";
  cacheLife("hours");
  cacheTag("services");
  const { data } = await api.GET("/api/v1/service-directions");
  if (!data) throw new Error("API: не вдалося завантажити напрямки послуг");
  return data;
}

export async function getPhotoCredits() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "products");
  const { data } = await api.GET("/api/v1/catalog/photo-credits");
  return data ?? [];
}

export async function getPickupPoints() {
  "use cache";
  cacheLife("hours");
  cacheTag("delivery");
  const { data } = await api.GET("/api/v1/delivery/pickup-points");
  return data ?? [];
}

export async function getCollections() {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "collections");
  const { data } = await api.GET("/api/v1/collections");
  return data ?? [];
}

/** Текстові сторінки й контакти редагуються в адмінці; API скидає тег після змін. */
export async function getPage(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("content", `page:${slug}`);
  const { data } = await api.GET("/api/v1/pages/{slug}", { params: { path: { slug } } });
  return data ?? null;
}

export async function getContacts() {
  "use cache";
  cacheLife("hours");
  cacheTag("content");
  const { data } = await api.GET("/api/v1/contacts");
  return data ?? null;
}

export async function getSeller() {
  "use cache";
  cacheLife("hours");
  cacheTag("content");
  const { data } = await api.GET("/api/v1/seller");
  return data ?? null;
}

export async function getSitemap() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "products", "categories");
  const { data } = await api.GET("/api/v1/catalog/sitemap");
  return data ?? { categories: [], products: [] };
}

/** Нова адреса для старого опублікованого шляху (розділ 10 ТЗ: перенаправлення після зміни URL). */
export async function resolveRedirect(path: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("redirects");
  const { data } = await api.GET("/api/v1/redirects/resolve", { params: { query: { path } } });
  return data?.to ?? null;
}
