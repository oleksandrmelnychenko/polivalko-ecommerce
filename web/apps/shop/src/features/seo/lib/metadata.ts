import type { Metadata } from "next";
import { hasShopName, pageTitle } from "@/shared/lib/page-title";
import { SITE_LOCALE, SITE_NAME } from "./site";

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
  images: ["/brand/polivalko-bucha.jpg"],
};

export function seoMetadata({ title, description, path, images = [], noIndex = false, exactTitle = false }: SeoInput): Metadata {
  const text = title.trim();
  const social = exactTitle || hasShopName(text) ? text : `${text} | ${SITE_NAME}`;
  const summary = description?.trim() || undefined;
  const pictures = images.filter((image): image is string => Boolean(image?.trim()));
  const previewImages = pictures.length ? pictures : defaultOpenGraph.images;
  return {
    title: exactTitle ? { absolute: text } : pageTitle(text),
    description: summary,
    alternates: { canonical: path },
    openGraph: { ...defaultOpenGraph, title: social, description: summary, url: path, images: previewImages },
    twitter: { card: pictures.length ? "summary_large_image" : "summary", title: social, description: summary, images: previewImages },
    robots: noIndex ? { index: false, follow: true } : undefined,
  };
}
