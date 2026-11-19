import { PageHead } from "@/features/content/server";
import { ArticleCards } from "./journal";
import { seoMetadata } from "@/features/seo";
import { notFound } from "next/navigation";
import { JOURNAL_ENABLED } from "./config";

export const metadata = seoMetadata({ title: "Блог Полі-Валько", description: "Поради з вибору товарів для саду, поливу й дому. Підготовка до садових робіт і послуги Полі-Валько в Бучі.", path: "/blog" });

export default function BlogPage() {
  if (!JOURNAL_ENABLED) notFound();
  return <div className="container journal-page"><PageHead path="/blog" title="Блог" lead="Про сад, полив і речі, з якими легше доглядати свою ділянку." /><ArticleCards /></div>;
}
