import "../styles/service-page.css";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { serviceIcon } from "@polivalko/shared/ui/service-icon";
import { breadcrumbJsonLd, JsonLd, serviceJsonLd } from "@/features/seo";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { sized } from "@/shared/lib/images";
import { getServiceDirections } from "../api/server";
import type { ServiceDirectionPage } from "@polivalko/shared/api/types";
import { serviceGroupOf, servicePath, serviceRequestHref } from "../lib/service-groups";

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
  const photo = page.imageUrl ? sized(page.imageUrl, "(max-width: 48rem) 100vw, (max-width: 107rem) 53vw, 880px", 960) : { src: group.photo };
  const Icon = serviceIcon(page.code);
  const path = servicePath(page.slug);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([...PARENTS, { name: page.name, path }])} />
      <JsonLd data={serviceJsonLd({ name: page.name, description: page.seoDescription || page.description, path, image: page.imageUrl })} />
      <Breadcrumbs current={page.name} parents={PARENTS} />

      <header className="service-page__head" data-group={group.key}>
        <div className="service-page__intro">
          <p className="service-page__group"><Icon aria-hidden="true" size={18} stroke={1.7} />{group.title}</p>
          <h1>{page.name}</h1>
          {page.description && <p className="lead">{page.description}</p>}
          <Link href={serviceRequestHref(page.code)} className="btn btn--graphite">Залишити заявку <ArrowRightIcon /></Link>
        </div>
        <div className="service-page__photo">
          <img {...photo} alt="" width={960} height={640} fetchPriority="high" decoding="async" />
        </div>
      </header>

      <div className="service-page__details">
        <div>
          {page.bodyHtml ? (
            <div className="prose service-page__body" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
          ) : (
            <p>Докладний опис послуги готуємо. Залиште заявку, і ми зателефонуємо, щоб обговорити вашу ділянку.</p>
          )}
        </div>
        <nav className="service-page__related" aria-labelledby="service-related-title">
          <h2 id="service-related-title">Інші послуги</h2>
          {related.length > 0 && <ul>
            {related.map((service) => {
              const RelatedIcon = serviceIcon(service.code);
              return (
                <li key={service.code}>
                  <Link href={servicePath(service.slug)}>
                    <span className="service-page__icon"><RelatedIcon aria-hidden="true" size={18} stroke={1.7} /></span>
                    {service.name}
                    <ArrowRightIcon />
                  </Link>
                </li>
              );
            })}
          </ul>}
          <Link href="/services" className="service-page__all">Усі послуги <ArrowRightIcon /></Link>
        </nav>
      </div>
    </>
  );
}
