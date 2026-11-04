import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { sized } from "@polivalko/shared/lib/images";
import { pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { getServiceDirections } from "../api/server";
import { ServiceRequestForm } from "./service-request-form";

export function ServicesScreen() {
  return (
    <div className="container">
      <header className="page-head">
        <nav className="crumbs" aria-label="Хлібні крихти">
          <ol>
            <li>
              <Link href="/">Головна</Link>
            </li>
            <li aria-current="page">Послуги</li>
          </ol>
        </nav>
        <h1>Сад, газон і автополив</h1>
        <p className="lead">Оберіть напрямок і залиште телефон: менеджер передзвонить, уточнить завдання й домовиться про виїзд.</p>
      </header>
      <Suspense fallback={<div className="skeleton" style={{ height: "var(--space-4xl)" }} />}>
        <ServicesContent />
      </Suspense>
    </div>
  );
}

async function ServicesContent() {
  await connection();
  const directions = await getServiceDirections();

  return (
    <div className="checkout">
      <div>
        <figure className="services-photo">
          <img {...sized(pagePhotos.services.url, "(max-width: 60rem) 92vw, 720px", 960)} alt={pagePhotos.services.alt} width={960} height={600} decoding="async" />
        </figure>
        <ul className="service-list">
          {directions.map((d) => (
            <li key={d.code}>
              <h2>{d.name}</h2>
              {d.description && <p>{d.description}</p>}
            </li>
          ))}
        </ul>
      </div>
      <ServiceRequestForm directions={directions} />
    </div>
  );
}
