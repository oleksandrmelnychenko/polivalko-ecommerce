import { HomeScreen } from "@/features/home/server";
import { seoMetadata } from "@/features/seo";

export const metadata = seoMetadata({
  title: "Poli Valko: товари для саду, городу й дому",
  description: "Товари для саду, городу й дому: полив, інструмент, садова техніка. Доставка Новою поштою по Україні або самовивіз з магазину.",
  path: "/",
  exactTitle: true,
});

export default function HomePage() {
  return <HomeScreen />;
}
