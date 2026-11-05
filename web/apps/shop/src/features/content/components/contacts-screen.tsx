import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getContacts, getPickupPoints } from "../api/server";
import { socialLinks } from "../lib/social-links";
import { ContactsPhone } from "./contacts-phone";
import { PageHead } from "./page-head";
import { SpecialDays } from "./special-days";

export function ContactsScreen() {
  return (
    <div className="container">
      <PageHead title="Контакти" lead="Магазин у Бучі: самовивіз, консультації й заявки на послуги." />
      <Suspense fallback={<div className="skeleton" style={{ height: "var(--space-4xl)" }} />}>
        <ContactsContent />
      </Suspense>
    </div>
  );
}

async function ContactsContent() {
  await connection();
  const [contacts, pickupPoints] = await Promise.all([getContacts(), getPickupPoints()]);
  const socials = socialLinks(contacts);

  return (
    <div className="contacts">
      <dl className="facts">
        <dt>Адреса</dt>
        <dd>
          <p>{contacts?.address ?? <span className="fill">адреса уточнюється</span>}</p>
          {contacts?.mapUrl && (
            <p>
              <a className="link" href={contacts.mapUrl} target="_blank" rel="noopener">
                Прокласти маршрут
              </a>
            </p>
          )}
        </dd>
        <dt>Графік</dt>
        <dd>
          <p>{contacts?.schedule ?? <span className="fill">графік уточнюється</span>}</p>
          <SpecialDays days={contacts?.specialDays} />
        </dd>
        <dt>Магазин</dt>
        <dd>
          {contacts?.storePhone ? <ContactsPhone value={contacts.storePhone} /> : <span className="fill">телефон уточнюється</span>}
          {contacts?.email && (
            <p>
              <a className="link" href={`mailto:${contacts.email}`}>
                {contacts.email}
              </a>
            </p>
          )}
        </dd>
        <dt>Послуги</dt>
        <dd>
          {contacts?.servicesPhone ? <ContactsPhone value={contacts.servicesPhone} /> : <p>Залиште заявку на сторінці послуг, і менеджер передзвонить.</p>}
          <p>
            <Link className="link" href="/services">
              Заявка на послугу
            </Link>
          </p>
        </dd>
        {pickupPoints.map((point) => (
          <div key={point.code} style={{ display: "contents" }}>
            <dt>Самовивіз</dt>
            <dd>
              <p>
                {point.name}, {point.address}
              </p>
              <p>{point.schedule}</p>
              <p className="muted">{point.instructions}</p>
            </dd>
          </div>
        ))}
        {socials.length > 0 && (
          <>
            <dt>Соцмережі</dt>
            <dd>
              <ul className="contacts__socials">
                {socials.map((s) => (
                  <li key={s.name}>
                    <a className="link" href={s.url} target="_blank" rel="noopener">
                      {s.name}
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
