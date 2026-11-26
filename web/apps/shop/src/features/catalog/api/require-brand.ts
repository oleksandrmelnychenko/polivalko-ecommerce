import "server-only";
import { notFound } from "next/navigation";
import { getBrandPage } from "./server";

/**
 * Resolves the brand page or ends the request with a real 404 (a brand with fewer than five products with a photo
 * has no page). Call it before any Suspense boundary: once streaming starts the status is already 200.
 */
export async function requireBrand(slug: string) {
  const brand = await getBrandPage(slug);
  if (brand) return brand;
  notFound();
}
