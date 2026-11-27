import { notFound } from "next/navigation";
import { PageHead } from "@/features/content/server";
import { itemListJsonLd, JsonLd, seoMetadata } from "@/features/seo";
import { articles } from "./articles";
import { JOURNAL_ENABLED } from "./config";
import { BlogIndex } from "./journal";

export const metadata = seoMetadata({
  title: "Блог про полив, догляд за садом і городом",
  description:
    "Експертні гіди Poli Valko: як обрати крапельний полив, садові шланги, інструмент, ґрунти та підготувати автополив у Бучі й по Україні.",
  path: "/blog",
});

export default function BlogPage() {
  if (!JOURNAL_ENABLED) notFound();
  return (
    <div className="container journal-page">
      <JsonLd
        data={itemListJsonLd(
          "Статті блогу Poli Valko",
          articles.map((article) => ({
            name: article.title,
            path: `/blog/${article.slug}`,
            image: article.image.url,
          })),
        )}
      />
      <PageHead
        path="/blog"
        title="Блог Poli-Valko"
      />
      <BlogIndex items={articles} />
    </div>
  );
}
