import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHead } from "@/components/info-page";
import { getPhotoCredits } from "@/lib/catalog";
import { thumb } from "@/lib/images";
import { categoryPhotos, pagePhotos } from "@/lib/stand-in-photos";

export const metadata: Metadata = { title: "Автори фото", robots: { index: false, follow: true } };

export default function CreditsPage() {
  return (
    <div className="container">
      <PageHead title="Автори фото" lead="Фото в прототипі тимчасові: їх замінять фото товарів магазину. Усі взяті з Unsplash за вільною ліцензією Unsplash." />
      <Suspense fallback={<div className="skeleton" style={{ height: "var(--space-4xl)" }} />}>
        <Credits />
      </Suspense>
    </div>
  );
}

/** Сторінка фото на джерелі: для Unsplash — сторінка фото за ідентифікатором, для інших — адреса як є. */
function sourcePage(url: string): string {
  const unsplash = url.match(/^https:\/\/images\.unsplash\.com\/(photo-[\w-]+)/);
  return unsplash ? `https://unsplash.com/photos/${unsplash[1].replace(/^photo-/, "")}` : url;
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
          <span>
            <span className="credits__credit">{p.credit}</span>
            <a className="link" href={sourcePage(p.url)} rel="noopener" target="_blank">
              Сторінка фото
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}
