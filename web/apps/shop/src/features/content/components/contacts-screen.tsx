import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { breadcrumbJsonLd, contactPageJsonLd, JsonLd } from "@/features/seo";
import { getContacts, getPickupPoints, getSeller } from "../api/server";
import { organizationSource } from "../lib/organization";
import { socialLinks } from "../lib/social-links";
import { SpecialDays } from "./special-days";

const TITLE = "Контакти";
const LEAD = "Адреса й графік магазину, телефони для замовлень і послуг.";
const tel = (value: string) => `tel:${value.replace(/[^\d+]/g, "")}`;

export function ContactsScreen() {
  return (
    <div className="container contacts-page">
      <JsonLd data={breadcrumbJsonLd([{ name: TITLE, path: "/contacts" }])} />
      <header className="contacts-header">
        <nav className="crumbs" aria-label="Хлібні крихти">
          <ol>
            <li><Link href="/">Головна</Link></li>
            <li aria-current="page">{TITLE}</li>
          </ol>
        </nav>
        <h1>{TITLE}</h1>
      </header>
      <Suspense fallback={<div className="skeleton" style={{ height: 320, marginBlock: "var(--space-xl)" }} />}>
        <ContactsContent />
      </Suspense>
    </div>
  );
}

async function ContactsContent() {
  await connection();
  const [contacts, pickupPoints, seller] = await Promise.all([getContacts(), getPickupPoints(), getSeller()]);
  const socials = socialLinks(contacts);
  const point = pickupPoints[0];
  const address = contacts?.address || point?.address || "Буча, Київська область";
  const schedule = contacts?.schedule || point?.schedule;
  const mapUrl = contacts?.mapUrl || point?.mapUrl;
  const pickupHowTo = point?.instructions || "Дочекайтеся повідомлення, що замовлення готове, і назвіть номер замовлення на касі.";

  return (
    <>
      <JsonLd data={contactPageJsonLd({ name: TITLE, description: LEAD, path: "/contacts", organization: organizationSource(contacts, seller) })} />
      <div className="contacts-details">
        <section aria-labelledby="contacts-store-title">
          <h2 id="contacts-store-title">Магазин</h2>
          <dl className="contacts-list">
            {contacts?.storePhone && (
              <div>
                <dt>Телефон</dt>
                <dd><a className="contacts-phone" href={tel(contacts.storePhone)}>{contacts.storePhone}</a></dd>
              </div>
            )}
            {contacts?.email && (
              <div>
                <dt>Електронна пошта</dt>
                <dd><a className="contacts-link" href={`mailto:${contacts.email}`}>{contacts.email}</a></dd>
              </div>
            )}
            <div>
              <dt>Адреса</dt>
              <dd>
                <p>{address}</p>
                {mapUrl && <a className="contacts-link" href={mapUrl} target="_blank" rel="noopener">Прокласти маршрут</a>}
              </dd>
            </div>
            {schedule && (
              <div>
                <dt>Графік роботи</dt>
                <dd>
                  <p>{schedule}</p>
                  <SpecialDays days={contacts?.specialDays} />
                </dd>
              </div>
            )}
          </dl>
          {point && (
            <section className="contacts-pickup" aria-labelledby="contacts-pickup-title">
              <h3 id="contacts-pickup-title">Самовивіз · {point.name}</h3>
              {point.address && point.address !== address && <p>{point.address}</p>}
              {point.schedule && point.schedule !== schedule && <p>{point.schedule}</p>}
              <p>{pickupHowTo}</p>
              {point.mapUrl && point.mapUrl !== mapUrl && (
                <a className="contacts-link" href={point.mapUrl} target="_blank" rel="noopener">Маршрут до пункту самовивозу</a>
              )}
            </section>
          )}
        </section>
        <div className="contacts-secondary">
          <section aria-labelledby="contacts-services-title">
            <h2 id="contacts-services-title">Послуги для саду</h2>
            {contacts?.servicesPhone && (
              <p><a className="contacts-phone" href={tel(contacts.servicesPhone)}>{contacts.servicesPhone}</a></p>
            )}
            <p>Залиште заявку, і менеджер передзвонить.</p>
            <Link className="contacts-link" href="/services#request">Заявка на послугу</Link>
          </section>
          {socials.length > 0 && (
            <section aria-labelledby="contacts-social-title">
              <h2 id="contacts-social-title">Соцмережі</h2>
              <ul className="contacts-socials">
                {socials.map((social) => (
                  <li key={social.name}>
                    <a className="contacts-link" href={social.url} target="_blank" rel="noopener">{social.name}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {seller && (
            <section aria-labelledby="contacts-seller-title">
              <h2 id="contacts-seller-title">Продавець</h2>
              <dl className="contacts-list contacts-list--seller">
                {seller.name && <div><dt>Назва</dt><dd>{seller.name}</dd></div>}
                {seller.taxId && <div><dt>Код</dt><dd>{seller.taxId}</dd></div>}
                {seller.address && <div><dt>Адреса</dt><dd>{seller.address}</dd></div>}
              </dl>
              <Link className="contacts-link" href="/offer">Публічна оферта</Link>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
