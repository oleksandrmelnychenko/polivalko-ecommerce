import { connection } from "next/server";
import { Fragment, Suspense } from "react";
import { getContacts } from "@/features/content/server";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { sized, thumb } from "@polivalko/shared/lib/images";
import { pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { ClipboardIcon, ClockIcon, PhoneIcon, PinIcon } from "@polivalko/shared/ui/icons";
import { SplitHero } from "@/shared/ui/split-hero";
import { getServiceDirections } from "../api/server";
import { DirectionRequestLink } from "./direction-request-link";
import { ServiceRequestForm } from "./service-request-form";

const STEPS = [
  { icon: <ClipboardIcon />, title: "Заявка", text: "Залиште ім'я й телефон у формі внизу сторінки та оберіть напрямок." },
  { icon: <PhoneIcon />, title: "Дзвінок менеджера", text: "Менеджер передзвонить і уточнить, що потрібно зробити на ділянці." },
  { icon: <PinIcon />, title: "Виїзд", text: "Разом обираєте день, коли фахівець приїде на ділянку." },
];

const PHOTO_SLOTS = [
  { at: 1, photo: pagePhotos.journey },
  { at: 6, photo: pagePhotos.sections },
];

export function ServicesScreen() {
  return (
    <div className="container services-page">
      <JsonLd data={breadcrumbJsonLd([{ name: "Послуги", path: "/services" }])} />
      <SplitHero
        crumb="Послуги"
        title="Послуги для саду"
        lead="Проєкт ділянки, автополив, газони, посадка рослин і сезонний догляд за садом."
        icon={<ClipboardIcon />}
        photo={pagePhotos.services}
        actions={
          <>
            <a className="btn" href="#request">
              Залишити заявку
            </a>
          </>
        }
      />

      <section className="ib-section" aria-labelledby="steps-title">
        <div className="ib-section__head">
          <h2 id="steps-title">Як замовити послугу</h2>
        </div>
        <ol className="ib-steps">
          {STEPS.map((step) => (
            <li key={step.title}>
              <span className="ib-steps__icon" aria-hidden="true">
                {step.icon}
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <Suspense fallback={<div className="skeleton" style={{ height: 480, marginTop: "var(--space-3xl)" }} />}>
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
      <section className="ib-section" id="directions" aria-labelledby="directions-title">
        <div className="ib-section__head">
          <h2 id="directions-title">Напрямки</h2>
          <p>Натисніть «Залишити заявку» на картці, і напрямок підставиться у форму.</p>
        </div>
        <ul className="svc-grid">
          {directions.map((d, index) => {
            const slot = PHOTO_SLOTS.find((s) => s.at === index && index < directions.length);
            return (
              <Fragment key={d.code}>
                {slot && (
                  <li className="svc-grid__photo" aria-hidden="true">
                    <img {...sized(slot.photo.url, "(max-width: 60rem) 50vw, 430px", 500)} alt="" width={500} height={375} loading="lazy" decoding="async" />
                  </li>
                )}
                <li className="svc-card">
                  {d.imageUrl && <img src={thumb(d.imageUrl, 120)} alt="" width={56} height={56} loading="lazy" decoding="async" className="svc-card__thumb" />}
                  <h3>{d.name}</h3>
                  {d.description && <p>{d.description}</p>}
                  <DirectionRequestLink code={d.code} />
                </li>
              </Fragment>
            );
          })}
        </ul>
      </section>

      <section className="svc-request" id="request" aria-labelledby="request-title">
        <div className="svc-request__intro">
          <h2 id="request-title">Заявка на послугу</h2>
          <p>Менеджер передзвонить у робочий час. У коментарі можна вказати площу ділянки або що саме треба зробити.</p>
          <ul className="svc-request__facts">
            {contacts?.servicesPhone && (
              <li>
                <PhoneIcon />
                <span>
                  Телефон для послуг:{" "}
                  <a className="link" href={`tel:${contacts.servicesPhone.replace(/[^\d+]/g, "")}`}>
                    {contacts.servicesPhone}
                  </a>
                </span>
              </li>
            )}
            {contacts?.schedule && (
              <li>
                <ClockIcon />
                <span>Графік: {contacts.schedule}</span>
              </li>
            )}
          </ul>
        </div>
        <ServiceRequestForm directions={directions} className="svc-request__form" />
      </section>
    </>
  );
}
