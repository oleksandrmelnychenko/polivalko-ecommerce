import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type CSSProperties } from "react";
import { breadcrumbJsonLd, contactPageJsonLd, JsonLd } from "@/features/seo";
import { pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { ArrowRightIcon, ClipboardIcon, ClockIcon, PhoneIcon, PinIcon, StoreIcon } from "@polivalko/shared/ui/icons";
import { SplitHero } from "@/shared/ui/split-hero";
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
      <Suspense fallback={<div className="skeleton" style={{ height: 420, marginBlock: "var(--space-xl)" }} />}>
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
  const mapUrl = contacts?.mapUrl || point?.mapUrl;

  const pickupHowTo = point?.instructions || "Дочекайтеся повідомлення, що замовлення готове, і назвіть номер замовлення на касі.";

  return (
    <>
      <JsonLd data={contactPageJsonLd({ name: TITLE, description: LEAD, path: "/contacts", organization: organizationSource(contacts, seller) })} />
      <SplitHero
        title={TITLE}
        lead={LEAD}
        icon={<PhoneIcon />}
        photo={pagePhotos.store}
        actions={
          <>
            {contacts?.storePhone && (
              <a className="btn" href={tel(contacts.storePhone)}>
                Подзвонити
              </a>
            )}
            {mapUrl && (
              <a className="btn btn--outline" href={mapUrl} target="_blank" rel="noopener">
                Прокласти маршрут
              </a>
            )}
          </>
        }
      />

      <div className="contacts-layout">
        <div className="contacts-main">
          <section className="ib-section" aria-labelledby="reach-title">
            <div className="ib-section__head">
              <h2 id="reach-title">Як з нами зв&apos;язатися</h2>
            </div>
            <ul className="ib-cards" style={{ "--cols": 2 } as CSSProperties}>
              <li className="ib-card ib-card--tint">
                <span className="ib-card__icon" aria-hidden="true">
                  <PinIcon />
                </span>
                <h3>Адреса</h3>
                <p>{contacts?.address ?? "Буча, Київська область"}</p>
                {mapUrl && (
                  <a className="ib-card__link" href={mapUrl} target="_blank" rel="noopener">
                    Прокласти маршрут
                    <ArrowRightIcon />
                  </a>
                )}
              </li>
              {contacts?.schedule && (
                <li className="ib-card">
                  <span className="ib-card__icon" aria-hidden="true">
                    <ClockIcon />
                  </span>
                  <h3>Графік</h3>
                  <p>{contacts.schedule}</p>
                  <SpecialDays days={contacts.specialDays} />
                </li>
              )}
              {(contacts?.storePhone || contacts?.email) && (
                <li className="ib-card">
                  <span className="ib-card__icon" aria-hidden="true">
                    <PhoneIcon />
                  </span>
                  <h3>Магазин</h3>
                  {contacts?.storePhone ? (
                    <p>
                      <a className="link" href={tel(contacts.storePhone)}>
                        {contacts.storePhone}
                      </a>
                    </p>
                  ) : null}
                  {contacts?.email && (
                    <p>
                      <a className="link" href={`mailto:${contacts.email}`}>
                        {contacts.email}
                      </a>
                    </p>
                  )}
                </li>
              )}
              <li className="ib-card ib-card--tint">
                <span className="ib-card__icon" aria-hidden="true">
                  <ClipboardIcon />
                </span>
                <h3>Послуги для саду</h3>
                {contacts?.servicesPhone ? (
                  <p>
                    <a className="link" href={tel(contacts.servicesPhone)}>
                      {contacts.servicesPhone}
                    </a>
                  </p>
                ) : (
                  <p>Залиште заявку, і менеджер передзвонить.</p>
                )}
                <Link className="ib-card__link" href="/services#request">
                  Заявка на послугу
                  <ArrowRightIcon />
                </Link>
              </li>
            </ul>
          </section>
        </div>

        <aside className="contacts-aside" aria-label="Магазин і продавець">
          {point && (
            <div className="ib-card ib-card--dark">
              <span className="ib-card__icon" aria-hidden="true">
                <StoreIcon />
              </span>
              <h3>{point.name}</h3>
              <p>{point.address}</p>
              <p>{pickupHowTo}</p>
              <dl className="ib-card__meta">
                <div>
                  <dt>Графік:</dt>
                  <dd>{point.schedule}</dd>
                </div>
              </dl>
              <div className="ib-card__buttons">
                {contacts?.storePhone && (
                  <a className="btn btn--light" href={tel(contacts.storePhone)}>
                    {contacts.storePhone}
                  </a>
                )}
                {mapUrl && (
                  <a className="btn btn--light" href={mapUrl} target="_blank" rel="noopener">
                    Прокласти маршрут
                  </a>
                )}
              </div>
            </div>
          )}

          {socials.length > 0 && (
            <div className="ib-card ib-card--tint">
              <h3>Ми в соцмережах</h3>
              <ul className="ib-card__buttons contacts-socials">
                {socials.map((s) => (
                  <li key={s.name}>
                    <a className="btn btn--light" href={s.url} target="_blank" rel="noopener">
                      {s.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {seller && (
            <div className="ib-card">
              <h3>Продавець</h3>
              <dl className="ib-card__meta contacts-seller">
                <div>
                  <dt>Назва:</dt>
                  <dd>{seller.name}</dd>
                </div>
                {seller.taxId && (
                  <div>
                    <dt>Код:</dt>
                    <dd>{seller.taxId}</dd>
                  </div>
                )}
                {seller.address && (
                  <div>
                    <dt>Адреса:</dt>
                    <dd>{seller.address}</dd>
                  </div>
                )}
              </dl>
              <Link className="ib-card__link" href="/offer">
                Публічна оферта
                <ArrowRightIcon />
              </Link>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
