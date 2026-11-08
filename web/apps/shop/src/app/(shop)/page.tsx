import { HomeScreen } from "@/features/home/server";
import { seoMetadata } from "@/features/seo";

export const metadata = seoMetadata({
  title: "Poli Valko: товари для дому, саду та городу",
  description: "Товари для саду, городу й дому з магазину в Бучі: полив, інструмент, садова техніка. Доставка Новою поштою по Україні, самовивіз у Бучі.",
  path: "/",
  exactTitle: true,
});

export default function HomePage() {
  return <HomeScreen />;
}
