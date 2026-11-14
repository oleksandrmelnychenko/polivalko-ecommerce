import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { AlertIcon } from "@polivalko/shared/ui/icons";
import { getPage } from "../api/server";
import { htmlSections } from "../lib/html-sections";
import { PageHead } from "./page-head";

const TOC_MIN_SECTIONS = 7;

type InfoPageProps = { slug: string; title: string; lead?: string; children?: ReactNode; layout?: "document" | "rows" };

export function InfoPage({ slug, title, lead, children, layout = "document" }: InfoPageProps) {
  return (
    <div className={`container doc-page doc-page--${layout}`}>
      <Suspense fallback={
        <>
          <PageHead path={`/${slug}`} title={title} lead={lead} />
          <div className="doc__loading" role="status">Завантажуємо текст сторінки…</div>
        </>
      }>
        <InfoContent slug={slug} layout={layout}>{children}</InfoContent>
      </Suspense>
    </div>
  );
}

async function InfoContent({ slug, children, layout }: Omit<InfoPageProps, "title" | "lead">) {
  await connection();
  const page = await getPage(slug);
  if (!page) notFound();
  const { intro, sections } = page.bodyHtml ? htmlSections(page.bodyHtml) : { intro: "", sections: [] };
  const anchor = (index: number) => `part-${index + 1}`;
  const toc = sections.length >= TOC_MIN_SECTIONS;

  return (
    <>
      <PageHead path={`/${slug}`} title={page.title} lead={page.lead} />

      <div className={toc ? "doc" : "doc doc--single"}>
        {toc && (
          <nav className="doc__toc" aria-label="Зміст сторінки">
            <p className="doc__toc-title">Зміст</p>
            <ul>
              {sections.map((section, index) => (
                <li key={section.title}>
                  <a href={`#${anchor(index)}`}>{section.title}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="doc__body">
          {intro && (
            <div className="doc__note">
              {layout === "document" && <AlertIcon />}
              <div className="prose" dangerouslySetInnerHTML={{ __html: intro }} />
            </div>
          )}
          {sections.map((section, index) => (
            <section key={section.title} id={anchor(index)} className="doc__section" aria-labelledby={`${anchor(index)}-title`}>
              <h2 id={`${anchor(index)}-title`}>{section.title}</h2>
              <div className="prose" dangerouslySetInnerHTML={{ __html: section.html }} />
            </section>
          ))}
          {!page.bodyHtml && (
            <div className="empty">
              <h2>Текст ще не додано</h2>
              <p>Поки що умови можна уточнити телефоном у магазині.</p>
            </div>
          )}
          {children}
        </div>
      </div>
    </>
  );
}
