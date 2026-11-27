import Link from "next/link";
import { notFound } from "next/navigation";
import { articleJsonLd, breadcrumbJsonLd, JsonLd, seoMetadata } from "@/features/seo";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { articles } from "./articles";
import { JOURNAL_ENABLED } from "./config";
import { GuideCover } from "./guide-cover";
import { GuideContents } from "./guide-contents";

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
  const chapters = article.sections.map((section, index) => ({
    id: `section-${index + 1}`,
    title: section.title.replace(/^\d+\.\s*/, ""),
  }));

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

      <article className="field-guide">
        <header className="field-guide__head">
          <div className="field-guide__title">
            <div className="field-guide__meta">
              <span className="guide-topic">{article.category}</span>
              <span>{article.readingMinutes} хв читання</span>
            </div>
            <h1>{article.title}</h1>
            <p className="field-guide__intro">{article.intro}</p>
            <p className="field-guide__credit">
              <span>{article.authorName}</span>
              <span>Оновлено <time dateTime={article.dateModified}>{formatDateUk(article.dateModified)}</time></span>
            </p>
          </div>
          <GuideCover story={article} priority />
        </header>

        <div className="field-guide__reading">
          <GuideContents chapters={chapters} />
          <div className="field-guide__chapters">
            {article.sections.map((section, index) => (
              <section className="field-guide__chapter" key={section.title} id={chapters[index].id}>
                <h2>{chapters[index].title}</h2>
                {section.text.map((text) => <p key={text}>{text}</p>)}
              </section>
            ))}
            <footer className="field-guide__resources">
              {article.relatedCategories.length > 0 && (
                <section>
                  <h2>Категорії каталогу</h2>
                  <ul className="chips chips--grey">
                    {article.relatedCategories.map((item) => (
                      <li key={item.href}><Link href={item.href}>{item.label}</Link></li>
                    ))}
                  </ul>
                </section>
              )}
              {!!article.relatedServices?.length && (
                <section>
                  <h2>Послуги для саду</h2>
                  <ul className="chips chips--grey">
                    {article.relatedServices.map((item) => (
                      <li key={item.href}><Link href={item.href}>{item.label}</Link></li>
                    ))}
                  </ul>
                </section>
              )}
              <Link className="btn" href={article.link.href}>{article.link.label} <ArrowRightIcon /></Link>
            </footer>
          </div>
        </div>
      </article>

      <section className="field-guide__related" aria-label="Інші практикуми">
        <header><h2>Ще почитати</h2><Link href="/blog">Усі статті <ArrowRightIcon /></Link></header>
        <ul>
          {articles.filter((item) => item.slug !== slug).slice(0, 3).map((item) => (
            <li key={item.slug}><Link href={`/blog/${item.slug}`}>
              <span className="field-guide__meta">{item.category} · {item.readingMinutes} хв читання</span>
              <h3>{item.title}</h3>
            </Link></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
