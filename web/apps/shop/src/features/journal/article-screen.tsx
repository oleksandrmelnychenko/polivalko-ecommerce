import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JOURNAL_ENABLED } from "./config";
import { articles } from "./articles";
import { ArticleCards } from "./journal";
import { seoMetadata } from "@/features/seo";
import { sized } from "@/shared/lib/images";

export function generateStaticParams() { return articles.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  if (!JOURNAL_ENABLED) notFound();
  const { slug } = await params;
  const article = articles.find((item) => item.slug === slug);
  if (!article) notFound();
  return seoMetadata({ title: article.title, description: article.intro, path: `/blog/${slug}` });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  if (!JOURNAL_ENABLED) notFound();
  const { slug } = await params;
  const article = articles.find((item) => item.slug === slug);
  if (!article) notFound();
  return <div className="container journal-page">
    <Breadcrumbs current={article.title} parents={[{ name: "Блог", path: "/blog" }]} />
    <article className="journal-article">
      <header><p className="journal-card__category">{article.category} · Полі-Валко</p><h1>{article.title}</h1><p className="lead">{article.intro}</p></header>
      <img className="journal-article__cover" {...sized(article.image.url, "(max-width: 64rem) 100vw, 960px", 960)} alt={article.image.alt} width={1200} height={720} fetchPriority="high" />
      <div className="journal-article__body">{article.sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.text.map((text) => <p key={text}>{text}</p>)}</section>)}
        <Link className="btn" href={article.link.href}>{article.link.label}</Link>
      </div>
    </article>
    <section className="journal-related" aria-label="Інші статті"><h2>Ще у блозі</h2><ArticleCards items={articles.filter((item) => item.slug !== slug).slice(0, 3)} /></section>
  </div>;
}
