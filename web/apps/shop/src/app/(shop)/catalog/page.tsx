import { CatalogScreen } from "@/features/catalog/server";
import { seoMetadata } from "@/features/seo";

export const metadata = seoMetadata({
  title: "Каталог",
  description: "Усі розділи Poli Valko: товари для саду, городу й дому з доставкою Новою поштою по Україні або самовивозом з магазину.",
  path: "/catalog",
});

export default function CatalogPage() {
  return <CatalogScreen />;
}
