import type { Metadata } from "next";
import { hasShopName, pageTitle } from "@/shared/lib/page-title";
import { absoluteUrl, SITE_LOCALE, SITE_NAME } from "./site";

export type SeoInput = {
  title: string;
  description?: string | null;
  path: string;
  images?: (string | null | undefined)[];
  noIndex?: boolean;
  exactTitle?: boolean;
};

export const defaultOpenGraph = {
  siteName: SITE_NAME,
  locale: SITE_LOCALE,
  type: "website" as const,
  images: [{ url: "/brand/poli-valko-social.png", width: 1200, height: 630, alt: "Poli Valko: товари для саду, городу й дому" }],
};

export function seoMetadata({ title, description, path, images = [], noIndex = false, exactTitle = false }: SeoInput): Metadata {
  const text = title.trim();
  const social = exactTitle || hasShopName(text) ? text : `${text} | ${SITE_NAME}`;
  const summary = description?.trim() || undefined;
  const pictures = images.filter((image): image is string => Boolean(image?.trim()));
  const isHome = path === "" || path === "/";

  // Next.js strips the trailing slash from `/` whenever `metadataBase` is set (`result.pathname === '/' ? result.origin`).
  // On the homepage we override `metadataBase: null` and emit explicit absolute URLs so `<link rel="canonical">` and
  // `og:url` emit `https://www.poli-valko.com/` (matching `sitemap-pages.xml`, JSON-LD, and the apex 308 redirect).
  const canonicalUrl = isHome ? absoluteUrl("/") : path;
  const previewImages = pictures.length
    ? (isHome ? pictures.map((image) => absoluteUrl(image)) : pictures)
    : (isHome ? defaultOpenGraph.images.map((image) => ({ ...image, url: absoluteUrl(image.url) })) : defaultOpenGraph.images);

  return {
    ...(isHome ? { metadataBase: null } : {}),
    title: exactTitle ? { absolute: text } : pageTitle(text),
    description: summary,
    alternates: { canonical: canonicalUrl },
    openGraph: { ...defaultOpenGraph, title: social, description: summary, url: canonicalUrl, images: previewImages },
    twitter: { card: "summary_large_image", title: social, description: summary, images: previewImages },
    // No `robots` key on an indexable page: even `undefined` replaces the root layout's value, and with it the
    // googlebot preview directives (max-image-preview and the rest).
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
