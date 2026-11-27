import "server-only";
import { notFound, permanentRedirect } from "next/navigation";
import { getBrandPage, resolveRedirect } from "./server";

/**
 * Resolves the brand page or ends the request with a real 308 (an old address saved as a redirect in the console)
 * or 404 (a brand with fewer than five products with a photo has no page).
 * Call it before any Suspense boundary: once streaming starts the status is already 200.
 */
export async function requireBrand(slug: string) {
  const brand = await getBrandPage(slug);
  if (brand) return brand;
  const target = await resolveRedirect(`/brands/${slug}`);
  if (target) permanentRedirect(target);
  notFound();
}
