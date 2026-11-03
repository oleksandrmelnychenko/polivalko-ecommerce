import type { Metadata } from "next";
import { CatalogScreen } from "@/features/shop/catalog/server";

export const metadata: Metadata = {
  title: "Каталог",
  alternates: { canonical: "/catalog" },
};

export default function CatalogPage() {
  return <CatalogScreen />;
}
