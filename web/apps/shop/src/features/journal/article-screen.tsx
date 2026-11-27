import Link from "next/link";
import { notFound } from "next/navigation";
import { articleJsonLd, breadcrumbJsonLd, JsonLd, seoMetadata } from "@/features/seo";
import { sized } from "@/shared/lib/images";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { articles } from "./articles";
import { JOURNAL_ENABLED } from "./config";
import { StoryList } from "./journal";

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
        <header className="journal-article__head">
          <div>
            <p className="journal-meta">{article.category} · {article.readingMinutes} хв читання</p>
            <h1>{article.title}</h1>
            <p className="lead">{article.intro}</p>
            <p className="journal-meta journal-byline">
              {article.authorName} · <time dateTime={article.dateModified}>{formatDateUk(article.dateModified)}</time>
            </p>
          </div>
          <img
            className="journal-article__cover"
            {...sized(article.image.url, "(max-width: 44rem) 100vw, 45vw", 960)}
            alt={article.image.alt}
            width={1200}
            height={720}
            fetchPriority="high"
          />
        </header>

        <div className="journal-reading">
          <nav className="journal-contents" aria-label="Зміст статті">
            <h2>У цій статті</h2>
            <ul>{article.sections.map((section, index) => (
              <li key={section.title}><a href={`#section-${index + 1}`}>{section.title}</a></li>
            ))}</ul>
          </nav>
          <div className="journal-article__body">
            {article.sections.map((section, index) => (
              <section key={section.title} id={`section-${index + 1}`}>
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
        </div>
      </article>

      <section className="journal-related" aria-label="Інші статті">
        <h2>Ще у блозі</h2>
        <StoryList items={articles.filter((item) => item.slug !== slug).slice(0, 3)} />
      </section>
    </div>
  );
}
