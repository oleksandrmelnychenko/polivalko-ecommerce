import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { api } from "@polivalko/shared/api/server";

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
