import { seoMetadata } from "@/features/seo";
import { ServicesScreen } from "@/features/services/server";

export const metadata = seoMetadata({
  title: "Послуги для саду в Бучі та Київській області",
  description: "Проєктування й монтаж автополиву, рулонні газони, ландшафтний дизайн і догляд за садом у Бучі, Ірпені, Гостомелі, Ворзелі та Київській області.",
  path: "/services",
});

export default function ServicesPage() {
  return <ServicesScreen />;
}
