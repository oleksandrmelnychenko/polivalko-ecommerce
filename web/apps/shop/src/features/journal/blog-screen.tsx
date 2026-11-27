import { notFound } from "next/navigation";
import { breadcrumbJsonLd, itemListJsonLd, JsonLd, seoMetadata } from "@/features/seo";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { articles } from "./articles";
import { JOURNAL_ENABLED } from "./config";
import { BlogIndex } from "./journal";

export const metadata = seoMetadata({
  title: "Блог про полив, догляд за садом і городом",
  description:
    "Практичні поради Poli Valko: як обрати крапельний полив, садові шланги, добрива, насіння, інструмент і доглядати за садом в Україні.",
  path: "/blog",
});

export default function BlogPage() {
  if (!JOURNAL_ENABLED) notFound();
  return (
    <div className="container journal-page">
      <JsonLd data={breadcrumbJsonLd([{ name: "Блог", path: "/blog" }])} />
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
      <Breadcrumbs current="Блог" />
      <header className="page-head">
        <h1>Блог Poli Valko</h1>
      </header>
      <BlogIndex items={articles} />
    </div>
  );
}
