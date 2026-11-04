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
