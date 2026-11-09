import "server-only";
import { notFound, permanentRedirect } from "next/navigation";
import { getCategory, resolveRedirect } from "./server";

/**
 * Resolves the category or ends the request with a real 308 or 404.
 * Call it before any Suspense boundary: once streaming starts the status is already 200.
 */
export async function requireCategory(slug: string) {
  const category = await getCategory(slug);
  if (category) return category;
  const target = await resolveRedirect(`/catalog/${slug}`);
  if (target) permanentRedirect(target);
  notFound();
}
