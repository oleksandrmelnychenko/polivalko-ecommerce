import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getContacts } from "@/features/content/server";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { getServiceDirections } from "../api/server";
import { DirectionRequestLink } from "./direction-request-link";
import { ServiceRequestForm } from "./service-request-form";

const STEPS = [
  { title: "Заявка", text: "Залиште ім'я й телефон у формі внизу сторінки та оберіть напрямок." },
  { title: "Дзвінок менеджера", text: "Менеджер передзвонить і уточнить, що потрібно зробити на ділянці." },
  { title: "Виїзд", text: "Разом обираєте день, коли фахівець приїде на ділянку." },
];

export function ServicesScreen() {
  return (
    <div className="container services-page">
      <JsonLd data={breadcrumbJsonLd([{ name: "Послуги", path: "/services" }])} />
      <header className="services-header">
        <nav className="crumbs" aria-label="Хлібні крихти">
          <ol>
            <li><Link href="/">Головна</Link></li>
            <li aria-current="page">Послуги</li>
          </ol>
        </nav>
        <h1>Послуги для саду</h1>
        <p>Проєкт ділянки, автополив, газони, посадка рослин і сезонний догляд за садом.</p>
        <a className="services-link" href="#request">Залишити заявку</a>
      </header>
      <Suspense fallback={<div className="skeleton" style={{ height: 480, marginTop: "var(--space-xl)" }} />}>
        <ServicesContent />
      </Suspense>
    </div>
  );
}

async function ServicesContent() {
  await connection();
  const [directions, contacts] = await Promise.all([getServiceDirections(), getContacts()]);

  return (
    <>
      <section className="services-section" id="directions" aria-labelledby="directions-title">
        <h2 id="directions-title">Напрямки</h2>
        <ul className="services-list">
          {directions.map((direction) => (
            <li key={direction.code} className="services-item">
              <h3>{direction.name}</h3>
              <div className="services-item__body">
                {direction.description && <p>{direction.description}</p>}
                <DirectionRequestLink code={direction.code} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="services-section" aria-labelledby="steps-title">
        <h2 id="steps-title">Як замовити послугу</h2>
        <ol className="services-steps">
          {STEPS.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="svc-request" id="request" aria-labelledby="request-title">
        <div className="svc-request__intro">
          <h2 id="request-title">Заявка на послугу</h2>
          <p>Менеджер передзвонить у робочий час. У коментарі можна вказати площу ділянки або що саме треба зробити.</p>
          <dl className="svc-request__facts">
            {contacts?.servicesPhone && (
              <div>
                <dt>Телефон для послуг</dt>
                <dd>
                  <a className="services-link" href={`tel:${contacts.servicesPhone.replace(/[^\d+]/g, "")}`}>
                    {contacts.servicesPhone}
                  </a>
                </dd>
              </div>
            )}
            {contacts?.schedule && (
              <div>
                <dt>Графік роботи</dt>
                <dd>{contacts.schedule}</dd>
              </div>
            )}
          </dl>
        </div>
        <ServiceRequestForm directions={directions} className="svc-request__form" />
      </section>
    </>
  );
}
