import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { api } from "@polivalko/shared/api/server";

export async function getProduct(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "products", `product:${slug}`);
  const { data, response } = await api.GET("/api/v1/products/{slug}", { params: { path: { slug } } });
  if (response.status === 404) return null;
  if (!data) throw new Error(`API: не вдалося завантажити товар ${slug}`);
  return data;
}
