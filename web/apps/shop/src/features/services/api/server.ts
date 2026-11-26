import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { api } from "@polivalko/shared/api/server";

export async function getServiceDirections() {
  "use cache";
  cacheLife("hours");
  cacheTag("services");
  const { data } = await api.GET("/api/v1/service-directions");
  if (!data) throw new Error("API: не вдалося завантажити напрямки послуг");
  return data;
}

/** One service page by its address; null when there is no such visible service. */
export async function getServiceDirectionPage(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("services", `service:${slug}`);
  const { data, response } = await api.GET("/api/v1/service-directions/{slug}", { params: { path: { slug } } });
  if (response.status === 404) return null;
  if (!data) throw new Error("API: не вдалося завантажити сторінку послуги");
  return data;
}
