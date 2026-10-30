import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHead } from "@/components/info-page";
import { getContacts, getPickupPoints } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Контакти",
  description: "Адреса, графік, телефони магазину й послуг Poli Valko у Бучі.",
  alternates: { canonical: "/contacts" },
};

export default function ContactsPage() {
  return (
    <div className="container">
      <PageHead title="Контакти" lead="Магазин у Бучі: самовивіз, консультації й заявки на послуги." />
      <Suspense fallback={<div className="skeleton" style={{ height: "var(--space-4xl)" }} />}>
        <ContactsContent />
      </Suspense>
    </div>
  );
}

/** Розділ 8 ТЗ: адреса, графік, телефони магазину й послуг, маршрут і соцмережі — з налаштувань адмінки. */
async function ContactsContent() {
  await connection();
  const [contacts, pickupPoints] = await Promise.all([getContacts(), getPickupPoints()]);
  const socials = [
    ["Instagram", contacts?.instagram],
    ["Facebook", contacts?.facebook],
    ["Telegram", contacts?.telegram],
    ["YouTube", contacts?.youTube],
  ].filter((s): s is [string, string] => Boolean(s[1]));

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
        <dd>{contacts?.schedule ?? <span className="fill">графік уточнюється</span>}</dd>
        <dt>Магазин</dt>
        <dd>
          {contacts?.storePhone ? <Phone value={contacts.storePhone} /> : <span className="fill">телефон уточнюється</span>}
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
          {contacts?.servicesPhone ? <Phone value={contacts.servicesPhone} /> : <p>Залиште заявку на сторінці послуг, і менеджер передзвонить.</p>}
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
                {socials.map(([name, url]) => (
                  <li key={name}>
                    <a className="link" href={url} target="_blank" rel="noopener">
                      {name}
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

function Phone({ value }: { value: string }) {
  return (
    <p>
      <a className="link" href={`tel:${value.replace(/[^\d+]/g, "")}`}>
        {value}
      </a>
    </p>
  );
}
