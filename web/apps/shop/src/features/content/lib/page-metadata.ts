import type { Metadata } from "next";
import { connection } from "next/server";
import { pageTitle } from "@/shared/lib/page-title";
import { getPage } from "../api/server";

export async function pageMetadata(slug: string, fallbackTitle: string): Promise<Metadata> {
  await connection();
  const page = await getPage(slug).catch(() => null);
  return {
    title: pageTitle(page?.seoTitle?.trim() || page?.title?.trim() || fallbackTitle),
    description: page?.seoDescription?.trim() || page?.lead?.trim() || undefined,
    alternates: { canonical: `/${slug}` },
  };
}
