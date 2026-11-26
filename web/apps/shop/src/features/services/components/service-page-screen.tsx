import "../styles/service-page.css";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { breadcrumbJsonLd, JsonLd, serviceJsonLd } from "@/features/seo";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { sized } from "@/shared/lib/images";
import { getServiceDirections } from "../api/server";
import type { ServiceDirectionPage } from "@polivalko/shared/api/types";
import { serviceGroupOf, servicePath, serviceRequestHref } from "../lib/service-groups";
import { DirectionRequestLink } from "./direction-request-link";

const PARENTS = [{ name: "Послуги для саду", path: "/services" }];

/** The page resolves the service first (see services/[slug]), so a missing one is a real 404. */
export function ServicePageScreen({ page }: { page: ServiceDirectionPage }) {
  return (
    <div className="container service-page">
      <Suspense fallback={<div className="skeleton service-page__placeholder" />}>
        <ServicePageContent page={page} />
      </Suspense>
    </div>
  );
}

async function ServicePageContent({ page }: { page: ServiceDirectionPage }) {
  await connection();
  const group = serviceGroupOf(page.code);
  const related = (await getServiceDirections().catch(() => []))
    .filter((service) => service.code !== page.code && group.codes.includes(service.code));
  const photo = page.imageUrl ? sized(page.imageUrl, "(max-width: 60rem) 100vw, 560px", 960) : { src: group.photo };
  const path = servicePath(page.slug);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([...PARENTS, { name: page.name, path }])} />
      <JsonLd data={serviceJsonLd({ name: page.name, description: page.seoDescription || page.description, path, image: page.imageUrl })} />
      <Breadcrumbs current={page.name} parents={PARENTS} />

      <header className="service-page__head">
        <div className="service-page__intro">
          <p className="service-page__group">{group.title}</p>
          <h1>{page.name}</h1>
          {page.description && <p className="lead">{page.description}</p>}
          <div className="service-page__actions">
            <Link href={serviceRequestHref(page.code)} className="btn">Залишити заявку <ArrowRightIcon /></Link>
            <Link href="/services" className="btn btn--outline">Усі послуги</Link>
          </div>
        </div>
        <img className="service-page__photo" {...photo} alt="" width={960} height={640} fetchPriority="high" decoding="async" />
      </header>

      {page.bodyHtml ? (
        <div className="prose service-page__body" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
      ) : (
        <p className="service-page__body">Докладний опис послуги готуємо. Залиште заявку, і ми зателефонуємо, щоб обговорити вашу ділянку.</p>
      )}

      <section className="service-page__cta" aria-labelledby="service-cta-title">
        <h2 id="service-cta-title">Обговорімо вашу ділянку</h2>
        <p>Залиште заявку: ми зателефонуємо, уточнимо задачу й узгодимо обсяг робіт, вартість і строки.</p>
        <Link href={serviceRequestHref(page.code)} className="btn">Залишити заявку <ArrowRightIcon /></Link>
      </section>

      {related.length > 0 && (
        <section className="service-page__related" aria-labelledby="service-related-title">
          <h2 id="service-related-title">{group.title}: інші послуги</h2>
          <ul>
            {related.map((service) => <li key={service.code}><DirectionRequestLink service={service} /></li>)}
          </ul>
        </section>
      )}
    </>
  );
}
