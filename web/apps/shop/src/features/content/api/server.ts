import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { api } from "@polivalko/shared/api/server";
import { loaded } from "@/shared/lib/api-result";
import type { Announcement, SiteHome } from "../lib/site-types";

const PENDING = /уточнюється/i;

export async function getPhotoCredits() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", "products");
  return loaded(await api.GET("/api/v1/catalog/photo-credits"), "авторів фото") ?? [];
}

export async function getPickupPoints() {
  "use cache";
  cacheLife("hours");
  cacheTag("delivery");
  return loaded(await api.GET("/api/v1/delivery/pickup-points"), "пункти самовивозу") ?? [];
}

export async function getDeliveryMethods() {
  "use cache";
  cacheLife("hours");
  cacheTag("delivery");
  return loaded(await api.GET("/api/v1/checkout/delivery-methods"), "способи отримання") ?? [];
}

export async function getPage(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("content", `page:${slug}`);
  return loaded(await api.GET("/api/v1/pages/{slug}", { params: { path: { slug } } }), `сторінку ${slug}`);
}

export async function getContacts() {
  "use cache";
  cacheLife("hours");
  cacheTag("content");
  return loaded(await api.GET("/api/v1/contacts"), "контакти");
}

export async function getSeller() {
  "use cache";
  cacheLife("hours");
  cacheTag("content");
  const data = loaded(await api.GET("/api/v1/seller"), "продавця");
  if (!data) return null;
  const seller = PENDING.test(data.name ?? "") ? { ...data, name: "" } : data;
  return Object.values(seller).some((value) => typeof value === "string" && value.trim()) ? seller : null;
}

export async function getCustomerMail() {
  "use cache";
  cacheLife("minutes");
  cacheTag("content", "customer-mail");
  const data = loaded(await api.GET("/api/v1/customer-mail"), "стан пошти");
  if (!data) throw new Error("API: не вдалося завантажити стан пошти");
  return data;
}

export async function getSiteHome(): Promise<SiteHome | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("content", "site", "home");
  return loaded(await api.GET("/api/v1/site/home"), "головну");
}

export async function getAnnouncement(): Promise<Announcement | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("content", "site", "home");
  const announcement = (await getSiteHome())?.announcement;
  return announcement?.text.trim() ? announcement : null;
}
