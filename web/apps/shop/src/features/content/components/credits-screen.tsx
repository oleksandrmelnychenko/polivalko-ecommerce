import { connection } from "next/server";
import { Suspense } from "react";
import { thumb } from "@polivalko/shared/lib/images";
import { categoryPhotos, pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { getPhotoCredits } from "../api/server";
import { sourcePage } from "../lib/source-page";
import { PageHead } from "./page-head";

export function CreditsScreen() {
  return (
    <div className="container credits-page">
      <PageHead path="/credits" title="Автори фото" lead="Тимчасові фото з Unsplash за ліцензією Unsplash. Згодом їх замінять фото товарів магазину." />
      <Suspense fallback={<div className="skeleton" style={{ height: "var(--space-4xl)" }} />}>
        <Credits />
      </Suspense>
    </div>
  );
}

async function Credits() {
  await connection();
  const products = await getPhotoCredits();
  const site = [...Object.values(categoryPhotos), ...Object.values(pagePhotos)].map((p) => ({ credit: p.credit, url: p.url }));
  const all = [...new Map([...products, ...site].map((p) => [p.url.split("?")[0], p])).values()];

  return (
    <ul className="credits">
      {all.map((p) => (
        <li key={p.url}>
          <img src={thumb(p.url, 250)} alt="" width={120} height={120} loading="lazy" decoding="async" />
          <span className="credits__credit">{p.credit}</span>
          <a className="credits__source" href={sourcePage(p.url)} rel="noopener" target="_blank">
            Сторінка фото
          </a>
        </li>
      ))}
    </ul>
  );
}
