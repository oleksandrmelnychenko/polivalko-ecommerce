import "server-only";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
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
  cacheTag("delivery", "content");
  const [directory, contacts] = await Promise.all([
    api.GET("/api/v1/delivery/pickup-points"),
    getContacts().catch(() => null),
  ]);
  const points = loaded(directory, "пункти самовивозу") ?? [];
  return points.map((point) => point.code === "bucha-store" && contacts ? {
    ...point,
    address: contacts.address?.trim() || point.address,
    schedule: contacts.schedule?.trim() || point.schedule,
    mapUrl: contacts.mapUrl || point.mapUrl,
  } : point);
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
  try {
    return loaded(await api.GET("/api/v1/site/home"), "головну");
  } catch (error) {
    // The static shell can use its default slides while the build runs outside the API network.
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return null;
    throw error;
  }
}

export async function getAnnouncement(): Promise<Announcement | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("content", "site", "home");
  const announcement = (await getSiteHome())?.announcement;
  return announcement?.text.trim() ? announcement : null;
}
