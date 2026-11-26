import { Suspense, type ReactNode } from "react";
import { introParagraphs } from "../lib/category-intro";
import { parsePage, type SearchParams } from "../lib/listing-params";

export function CategoryIntro({ description }: { description?: string | null }) {
  const paragraphs = introParagraphs(description);
  if (paragraphs.length === 0) return null;
  return (
    <section className="category-intro" aria-labelledby="category-intro-heading">
      <h2 id="category-intro-heading">Про розділ</h2>
      {paragraphs.map((text, i) => (
        <p key={i}>{text}</p>
      ))}
    </section>
  );
}

/**
 * The intro belongs to the first page only: pages 2, 3… are separate URLs, and the same text on each of them is
 * duplicate content. The shell renders the intro (no layout shift on page 1); a later page removes it once its
 * search params are known.
 */
export function FirstPageIntro({ description, searchParams }: { description?: string | null; searchParams: Promise<SearchParams> }) {
  const intro = <CategoryIntro description={description} />;
  return (
    <Suspense fallback={intro}>
      <IntroOnFirstPage searchParams={searchParams}>{intro}</IntroOnFirstPage>
    </Suspense>
  );
}

async function IntroOnFirstPage({ searchParams, children }: { searchParams: Promise<SearchParams>; children: ReactNode }) {
  return parsePage((await searchParams).page) === 1 ? children : null;
}
