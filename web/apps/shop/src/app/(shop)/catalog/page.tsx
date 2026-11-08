import { CatalogScreen } from "@/features/catalog/server";
import { seoMetadata } from "@/features/seo";

export const metadata = seoMetadata({
  title: "Каталог",
  description: "Усі розділи Poli Valko: товари для дому, саду та городу з доставкою Новою поштою по Україні й самовивозом у Бучі.",
  path: "/catalog",
});

export default function CatalogPage() {
  return <CatalogScreen />;
}
