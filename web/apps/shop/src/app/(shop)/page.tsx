import { HomeScreen } from "@/features/home/server";
import { seoMetadata } from "@/features/seo";

export const metadata = seoMetadata({
  title: "Poli Valko — все для поливу, саду й городу в Україні",
  description: "Інтернет-магазин Poli Valko: системи поливу, насіння, добрива та садовий інструмент. Доставка Новою поштою по Україні, самовивіз у Бучі.",
  path: "/",
  exactTitle: true,
});

export default function HomePage() {
  return <HomeScreen />;
}
