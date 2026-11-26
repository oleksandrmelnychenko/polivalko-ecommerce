import { Suspense, type ReactNode } from "react";
import { categoryIcon } from "@polivalko/shared/ui/category-icon";
import { introParagraphs } from "../lib/category-intro";
import { parsePage, type SearchParams } from "../lib/listing-params";

type IntroProps = { name: string; description?: string | null; isSubcategory: boolean };

function IntroHeading({ icon: Icon }: { icon: ReturnType<typeof categoryIcon> }) {
  return <h2 id="category-intro-heading"><Icon aria-hidden="true" stroke={1.7} />Про розділ</h2>;
}

export function CategoryIntro({ name, description, isSubcategory }: IntroProps) {
  const paragraphs = introParagraphs(description);
  if (paragraphs.length === 0) return null;
  return (
    <section className="category-intro" aria-labelledby="category-intro-heading">
      <IntroHeading icon={categoryIcon(name, isSubcategory)} />
      <div className="category-intro__text">
        {paragraphs.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </div>
    </section>
  );
}

/**
 * The intro belongs to the first page only: pages 2, 3… are separate URLs, and the same text on each of them is
 * duplicate content. The shell renders the intro (no layout shift on page 1); a later page removes it once its
 * search params are known.
 */
export function FirstPageIntro({ searchParams, ...props }: IntroProps & { searchParams: Promise<SearchParams> }) {
  const intro = <CategoryIntro {...props} />;
  return (
    <Suspense fallback={intro}>
      <IntroOnFirstPage searchParams={searchParams}>{intro}</IntroOnFirstPage>
    </Suspense>
  );
}

async function IntroOnFirstPage({ searchParams, children }: { searchParams: Promise<SearchParams>; children: ReactNode }) {
  return parsePage((await searchParams).page) === 1 ? children : null;
}
