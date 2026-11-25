import { getImageProps } from "next/image";
import * as stock from "@polivalko/shared/lib/images";
import { CATALOG_PHOTO_HOST } from "./catalog-photo-host";

export type { Sized } from "@polivalko/shared/lib/images";

// Catalog photos sit in Vercel Blob as uploaded: up to 1400 px and 2 MB for a 320 px tile. These go through
// the Next.js image optimizer (/_next/image, allowed in next.config.ts) at the width the layout needs.
// Blob names are never reused (a new upload gets a new name), so the optimizer may cache them for a long time.
const CATALOG_PHOTO = `https://${CATALOG_PHOTO_HOST}/catalog/`;

export const isCatalogPhoto = (url: string) => url.startsWith(CATALOG_PHOTO);

function optimized(url: string, width: number, sizes?: string): stock.Sized {
  const { props } = getImageProps({ src: url, alt: "", width, height: width, sizes });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}

/**
 * Next.js lists every configured width from 256 up to 1600 for a `sizes` image. A photo drawn at most
 * `fallbackWidth` wide never needs more than twice that even on a 2x screen, so wider candidates only make the
 * page heavier (each is written twice, in the HTML and in the RSC payload) and src pointed at the 1600 one.
 */
function capped(image: stock.Sized, maxWidth: number): stock.Sized {
  const candidates = image.srcSet?.split(", ").map((entry) => ({ entry, width: Number(entry.slice(entry.lastIndexOf(" ") + 1, -1)) }));
  const kept = candidates?.filter((candidate) => candidate.width <= maxWidth);
  if (!kept?.length) return image;
  const widest = kept[kept.length - 1].entry;
  return { ...image, src: widest.slice(0, widest.lastIndexOf(" ")), srcSet: kept.map((candidate) => candidate.entry).join(", ") };
}

export function sized(url: string, sizes: string, fallbackWidth: 330 | 500 | 960 = 500): stock.Sized {
  return isCatalogPhoto(url) ? capped(optimized(url, fallbackWidth, sizes), fallbackWidth * 2) : stock.sized(url, sizes, fallbackWidth);
}

export function portrait(url: string, sizes: string): stock.Sized {
  return isCatalogPhoto(url) ? optimized(url, 960, sizes) : stock.portrait(url, sizes);
}

/** One URL about `width` pixels wide: a 2x source for a thumbnail shown at half that size. */
export function thumb(url: string, width: 120 | 250 = 250): string {
  // getImageProps puts the 2x candidate in src, so ask for half the width to get roughly `width`.
  return isCatalogPhoto(url) ? optimized(url, Math.ceil(width / 2)).src : stock.thumb(url, width);
}
