import "server-only";
import { notFound, permanentRedirect } from "next/navigation";
import { resolveRedirect } from "@/features/catalog/server";
import { getProduct } from "./server";

/**
 * Resolves the product or ends the request with a real 308 or 404.
 * Call it before any Suspense boundary: once streaming starts the status is already 200.
 */
export async function requireProduct(slug: string) {
  const product = await getProduct(slug);
  if (product) return product;
  const target = await resolveRedirect(`/product/${slug}`);
  if (target) permanentRedirect(target);
  notFound();
}
