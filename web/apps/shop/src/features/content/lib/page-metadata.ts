import type { Metadata } from "next";
import { connection } from "next/server";
import { seoMetadata } from "@/features/seo";
import { getPage } from "../api/server";

export async function pageMetadata(slug: string, fallbackTitle: string): Promise<Metadata> {
  await connection();
  const page = await getPage(slug).catch(() => null);
  return seoMetadata({
    title: page?.seoTitle?.trim() || page?.title?.trim() || fallbackTitle,
    description: page?.seoDescription?.trim() || page?.lead?.trim(),
    path: `/${slug}`,
  });
}
