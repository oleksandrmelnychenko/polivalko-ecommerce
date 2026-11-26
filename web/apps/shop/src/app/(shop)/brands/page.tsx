import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrandsScreen, getBrandPages } from "@/features/catalog/server";
import { seoMetadata } from "@/features/seo";

export const metadata: Metadata = seoMetadata({
  title: "Бренди",
  description: "Бренди товарів для саду, городу й поливу в Poli Valko: Hunter, SeedEra, Gardena, Fiskars, Irritec та інші. Доставка Новою поштою по Україні.",
  path: "/brands",
});

export default function BrandsPage() {
  return (
    <Suspense fallback={<div className="container brands-page"><div className="skeleton" style={{ height: 320 }} /></div>}>
      <Brands />
    </Suspense>
  );
}

// At request time, like the other catalog pages: the build has no API to ask for the brand list.
async function Brands() {
  await connection();
  return <BrandsScreen brands={await getBrandPages()} />;
}
