import Link from "next/link";
import { notFound } from "next/navigation";
import { articleJsonLd, breadcrumbJsonLd, JsonLd, seoMetadata } from "@/features/seo";
import { sized } from "@/shared/lib/images";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { articles } from "./articles";
import { JOURNAL_ENABLED } from "./config";
import { ArticleCards } from "./journal";

export function generateStaticParams() {
  return articles.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  if (!JOURNAL_ENABLED) notFound();
  const { slug } = await params;
  const article = articles.find((item) => item.slug === slug);
  if (!article) notFound();
  return seoMetadata({
    title: article.seoTitle,
    description: article.seoDescription,
    path: `/blog/${slug}`,
    images: [article.image.url],
  });
}

function formatDateUk(iso: string) {
  try {
    return new Intl.DateTimeFormat("uk-UA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${iso}T12:00:00Z`));
  } catch {
    return iso;
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  if (!JOURNAL_ENABLED) notFound();
  const { slug } = await params;
  const article = articles.find((item) => item.slug === slug);
  if (!article) notFound();

  const path = `/blog/${slug}`;
  const parents = [{ name: "Блог", path: "/blog" }];

  return (
    <div className="container journal-page">
      <JsonLd data={breadcrumbJsonLd([...parents, { name: article.title, path }])} />
      <JsonLd
        data={articleJsonLd({
          title: article.title,
          description: article.seoDescription,
          path,
          image: article.image.url,
          datePublished: article.datePublished,
          dateModified: article.dateModified,
          authorName: article.authorName,
        })}
      />

      <Breadcrumbs current={article.title} parents={parents} />

      <article className="journal-article">
        <header>
          <p className="journal-card__category">
            {article.category} · {article.authorName} ·{" "}
            <time dateTime={article.dateModified}>{formatDateUk(article.dateModified)}</time> ·{" "}
            {article.readingMinutes} хв читання
          </p>
          <h1>{article.title}</h1>
          <p className="lead">{article.intro}</p>
        </header>

        <img
          className="journal-article__cover"
          {...sized(article.image.url, "(max-width: 64rem) 100vw, 960px", 960)}
          alt={article.image.alt}
          width={1200}
          height={720}
          fetchPriority="high"
        />

        <div className="journal-article__body">
          {article.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.text.map((text) => (
                <p key={text}>{text}</p>
              ))}
            </section>
          ))}

          <Link className="btn" href={article.link.href}>
            {article.link.label}
          </Link>

          {article.relatedCategories.length > 0 && (
            <section aria-labelledby="article-related-categories">
              <h2 id="article-related-categories">Рекомендовані категорії каталогу</h2>
              <ul className="chips chips--grey">
                {article.relatedCategories.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {article.relatedServices && article.relatedServices.length > 0 && (
            <section aria-labelledby="article-related-services">
              <h2 id="article-related-services">Послуги Poli Valko у Бучі та Київській області</h2>
              <ul className="chips chips--grey">
                {article.relatedServices.map((service) => (
                  <li key={service.href}>
                    <Link href={service.href}>{service.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </article>

      <section className="journal-related" aria-label="Інші статті">
        <h2>Ще у блозі</h2>
        <ArticleCards items={articles.filter((item) => item.slug !== slug).slice(0, 3)} />
      </section>
    </div>
  );
}
