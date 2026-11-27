import Link from "next/link";
import { sized } from "@/shared/lib/images";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { articles, type Article } from "./articles";
import { JOURNAL_ENABLED } from "./config";

export function ArticleCards({ items = articles }: { items?: Article[] }) {
  return (
    <ul className="journal-grid">
      {items.map((article) => (
        <li key={article.slug}>
          <Link href={`/blog/${article.slug}`} className="journal-card">
            <img
              {...sized(article.image.url, "(max-width: 40rem) 100vw, (max-width: 64rem) 50vw, 33vw", 960)}
              alt={article.image.alt}
              width={800}
              height={560}
              loading="lazy"
            />
            <span className="journal-card__category">{article.category}</span>
            <h2>{article.title}</h2>
            <p>{article.intro}</p>
            <span className="journal-card__more">
              Читати статтю <ArrowRightIcon />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function BlogIndex({ items }: { items: Article[] }) {
  const [first, ...rest] = items;
  if (!first) return null;
  return (
    <>
      <Link className="journal-feature" href={`/blog/${first.slug}`}>
        <img {...sized(first.image.url, "(max-width: 44rem) 100vw, 50vw", 960)}
          alt={first.image.alt} width={960} height={640} fetchPriority="high" />
        <div className="journal-feature__copy">
          <span className="journal-meta">{first.category} · {first.readingMinutes} хв читання</span>
          <h2>{first.title}</h2>
          <p>{first.intro}</p>
          <span className="btn">Читати статтю <ArrowRightIcon /></span>
        </div>
      </Link>
      <StoryList items={rest} />
    </>
  );
}

export function StoryList({ items }: { items: Article[] }) {
  return (
    <ul className="journal-stories">
      {items.map((article) => (
        <li key={article.slug}>
          <Link href={`/blog/${article.slug}`}>
            <img {...sized(article.image.url, "(max-width: 44rem) 88px, 144px", 330)}
              alt="" width={144} height={112} loading="lazy" />
            <div>
              <span className="journal-meta">{article.category} · {article.readingMinutes} хв</span>
              <h2>{article.title}</h2>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function JournalPreview() {
  if (!JOURNAL_ENABLED) return null;
  return (
    <section className="container home-section journal-preview" aria-labelledby="journal-title">
      <div className="home-section__head">
        <div className="home-section__titles">
          <h2 id="journal-title">Блог Poli-Valko</h2>
        </div>
        <Link href="/blog" className="home-section__more">
          Усі статті <ArrowRightIcon />
        </Link>
      </div>
      <StoryList items={articles.slice(0, 3)} />
    </section>
  );
}
