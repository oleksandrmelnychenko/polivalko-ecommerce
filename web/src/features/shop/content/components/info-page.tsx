import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { getPage } from "../api/server";
import { PageHead } from "./page-head";

export function InfoPage({ slug, children }: { slug: string; children?: ReactNode }) {
  return (
    <div className="container">
      <Suspense fallback={<div className="skeleton" style={{ height: "var(--space-4xl)", marginBlock: "var(--space-2xl)" }} />}>
        <InfoContent slug={slug}>{children}</InfoContent>
      </Suspense>
    </div>
  );
}

async function InfoContent({ slug, children }: { slug: string; children?: ReactNode }) {
  await connection();
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <>
      <PageHead title={page.title} lead={page.lead} />
      {page.bodyHtml ? (
        <div className="prose" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
      ) : (
        <div className="prose">
          <div className="empty">
            <h2>Текст готує магазин</h2>
            <p>Остаточну редакцію погоджуємо перед запуском.</p>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
