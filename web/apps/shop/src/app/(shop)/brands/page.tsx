import type { Metadata } from "next";
import { BrandsScreen, getBrandPages } from "@/features/catalog/server";
import { seoMetadata } from "@/features/seo";

export const metadata: Metadata = seoMetadata({
  title: "Бренди",
  description: "Бренди товарів для саду, городу й поливу в Poli Valko: Hunter, SeedEra, Gardena, Fiskars, Irritec та інші. Доставка Новою поштою по Україні.",
  path: "/brands",
});

export default async function BrandsPage() {
  return <BrandsScreen brands={await getBrandPages()} />;
}
