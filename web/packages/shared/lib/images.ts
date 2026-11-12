const WIKIMEDIA_THUMB = /^https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/\d+px-[^/]+$/;
const UNSPLASH = /^https:\/\/images\.unsplash\.com\//;
const WIKIMEDIA_WIDTHS = [330, 500, 960] as const;
const UNSPLASH_WIDTHS = [360, 540, 800, 1200, 1600] as const;
const PORTRAIT_WIDTHS = [540, 800, 1200] as const;

const resizeWikimedia = (url: string, width: number) => url.replace(/\/\d+px-([^/]+)$/, `/${width}px-$1`);

function resizeUnsplash(url: string, width: number, height?: number): string {
  const u = new URL(url);
  u.searchParams.set("auto", "format");
  u.searchParams.set("fit", "crop");
  u.searchParams.set("q", width <= 540 ? "70" : "75");
  u.searchParams.set("w", String(width));
  if (height) u.searchParams.set("h", String(height));
  else u.searchParams.delete("h");
  return u.toString();
}

export type Sized = { src: string; srcSet?: string; sizes?: string };

export function sized(url: string, sizes: string, fallbackWidth: 330 | 500 | 960 = 500): Sized {
  if (UNSPLASH.test(url)) {
    const fallback = fallbackWidth === 330 ? 360 : fallbackWidth === 500 ? 540 : 1200;
    return { src: resizeUnsplash(url, fallback), srcSet: UNSPLASH_WIDTHS.map((w) => `${resizeUnsplash(url, w)} ${w}w`).join(", "), sizes };
  }
  if (!WIKIMEDIA_THUMB.test(url)) return { src: url };
  return { src: resizeWikimedia(url, fallbackWidth), srcSet: WIKIMEDIA_WIDTHS.map((w) => `${resizeWikimedia(url, w)} ${w}w`).join(", "), sizes };
}

export function portrait(url: string, sizes: string): Sized {
  if (!UNSPLASH.test(url)) return sized(url, sizes, 960);
  return { src: resizeUnsplash(url, 800, 1200), srcSet: PORTRAIT_WIDTHS.map((w) => `${resizeUnsplash(url, w, w * 1.5)} ${w}w`).join(", "), sizes };
}

export function thumb(url: string, width: 120 | 250 = 250): string {
  if (UNSPLASH.test(url)) return resizeUnsplash(url, width, width);
  return WIKIMEDIA_THUMB.test(url) ? resizeWikimedia(url, width) : url;
}
