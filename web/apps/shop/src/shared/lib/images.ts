import { getImageProps } from "next/image";
import * as stock from "@polivalko/shared/lib/images";

export type { Sized } from "@polivalko/shared/lib/images";

// Catalog photos sit in Vercel Blob as uploaded: up to 1400 px and 2 MB for a 320 px tile. These go through
// the Next.js image optimizer (/_next/image, allowed in next.config.ts) at the width the layout needs.
// Blob names are never reused (a new upload gets a new name), so the optimizer may cache them for a long time.
const CATALOG_PHOTO = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/catalog\//;

export const isCatalogPhoto = (url: string) => CATALOG_PHOTO.test(url);

function optimized(url: string, width: number, sizes?: string): stock.Sized {
  const { props } = getImageProps({ src: url, alt: "", width, height: width, sizes });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}

export function sized(url: string, sizes: string, fallbackWidth: 330 | 500 | 960 = 500): stock.Sized {
  return isCatalogPhoto(url) ? optimized(url, fallbackWidth, sizes) : stock.sized(url, sizes, fallbackWidth);
}

export function portrait(url: string, sizes: string): stock.Sized {
  return isCatalogPhoto(url) ? optimized(url, 960, sizes) : stock.portrait(url, sizes);
}

/** One URL about `width` pixels wide: a 2x source for a thumbnail shown at half that size. */
export function thumb(url: string, width: 120 | 250 = 250): string {
  // getImageProps puts the 2x candidate in src, so ask for half the width to get roughly `width`.
  return isCatalogPhoto(url) ? optimized(url, Math.ceil(width / 2)).src : stock.thumb(url, width);
}
