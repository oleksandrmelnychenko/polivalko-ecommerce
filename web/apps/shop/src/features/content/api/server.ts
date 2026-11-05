import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { api } from "@polivalko/shared/api/server";
import type { Announcement, SiteHome } from "../lib/site-types";

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

export async function getSiteHome(): Promise<SiteHome | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("content", "site", "home");
  try {
    const { data } = await api.GET("/api/v1/site/home");
    return data ?? null;
  } catch {
    return null;
  }
}

export async function getAnnouncement(): Promise<Announcement | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("content", "site", "home");
  const announcement = (await getSiteHome())?.announcement;
  return announcement?.text.trim() ? announcement : null;
}
