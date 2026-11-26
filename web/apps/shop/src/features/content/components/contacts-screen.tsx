import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { breadcrumbJsonLd, contactPageJsonLd, JsonLd } from "@/features/seo";
import { getServiceDirections, ServiceRequestForm } from "@/features/services/server";
import { ArrowRightIcon, ClockIcon, PinIcon } from "@polivalko/shared/ui/icons";
import { directionsUrl } from "@/shared/lib/directions-url";
import { getContacts, getPickupPoints, getSeller } from "../api/server";
import { organizationSource } from "../lib/organization";
import { socialLinks } from "../lib/social-links";
import { SpecialDays } from "./special-days";
import { SocialLinksList } from "./social-links";

const tel = (value: string) => "tel:" + value.replace(/[^\d+]/g, "");
function isRealSocialProfile(url: string): boolean {
  if (!/^https?:/i.test(url)) return true;
  if (!URL.canParse(url)) return false;
  const parsed = new URL(url);
  return parsed.pathname.replace(/\/+$/, "").length > 0 || Boolean(parsed.search || parsed.hash);
}
export function ContactsScreen() {
  return (
    <div className="container contact-page">
      <Breadcrumbs current="Контакти" />
      <JsonLd data={breadcrumbJsonLd([{ name: "Контакти", path: "/contacts" }])} />
      <Suspense fallback={<div className="skeleton" style={{ height: 680 }} />}>
        <ContactsContent />
      </Suspense>
    </div>
  );
}
async function ContactsContent() {
  await connection();
  const [contacts, points, seller, directions] = await Promise.all([getContacts(), getPickupPoints().catch(()=>[]), getSeller().catch(()=>null), getServiceDirections().catch(()=>[])]);
  const point = points[0];
  const address = contacts?.address || point?.address || "Буча, Київська область";
  const schedule = contacts?.schedule || point?.schedule;
  const mapUrl = contacts?.mapUrl || point?.mapUrl;
  const route = directionsUrl(mapUrl, contacts?.address || point?.address);
  const socials = socialLinks(contacts).filter((item) => !item.placeholder && isRealSocialProfile(item.url));
  const mapQuery = (mapUrl && URL.canParse(mapUrl) && new URL(mapUrl).searchParams.get("query")) || address;
  const mapEmbed = "https://maps.google.com/maps?" + new URLSearchParams({ q: mapQuery, z: "16", hl: "uk", output: "embed" });
  return <>
    <JsonLd data={contactPageJsonLd({ name: "Контакти", description: "Адреса й графік магазину, телефони для замовлень і послуг.", path: "/contacts", organization: organizationSource(contacts, seller) })} />
    <header className="contact-poster garden-print">
      <div className="contact-directory">
        <h1>Контакти</h1>
        <dl className="contact-lines">
          {contacts?.storePhone && <div><dt>Магазин і замовлення</dt><dd><a href={tel(contacts.storePhone)}>{contacts.storePhone}</a></dd></div>}
          {contacts?.servicesPhone && <div><dt>Послуги для саду</dt><dd><a href={tel(contacts.servicesPhone)}>{contacts.servicesPhone}</a></dd></div>}
          {contacts?.email && <div><dt>Електронна пошта</dt><dd><a href={"mailto:" + contacts.email}>{contacts.email}</a></dd></div>}
        </dl>
        <nav className="contact-jumps" aria-label="На цій сторінці">
          <a className="btn btn--graphite" href="#store"><PinIcon /> Як нас знайти</a>
          {directions.length > 0 && <a href="#request">Заявка на послугу <ArrowRightIcon /></a>}
        </nav>
      </div>
    </header>
    {socials.length > 0 && <nav className="contact-social" aria-label="Месенджери та соцмережі"><SocialLinksList links={socials} /></nav>}
    <section id="store" className="contact-visit info-sheet" aria-labelledby="contact-store-title">
        <div className="contact-location">
          <h2 id="contact-store-title">Адреса магазину</h2>
          <address>{address}</address>
          {(schedule || contacts?.specialDays?.length) ? <div className="contact-hours">
            <ClockIcon /><span className="visually-hidden">Графік роботи</span>
            {schedule && <p>{schedule}</p>}
            <SpecialDays days={contacts?.specialDays} />
          </div> : null}
          <div className="contact-visit-actions">
            {route && <a className="contact-route btn btn--graphite" href={route} target="_blank" rel="noopener noreferrer">Прокласти маршрут <ArrowRightIcon /></a>}
            <Link href="/payment-delivery">Умови самовивозу</Link>
          </div>
        </div>
        {(contacts?.address || point?.address) && <iframe className="contact-map" src={mapEmbed} title="Магазин на карті" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />}
    </section>
    {directions.length > 0 && (
      <section id="request" className="contact-request-sheet info-sheet" aria-labelledby="contact-services-title">
        <ServiceRequestForm directions={directions} />
      </section>
    )}
    {seller && (seller.name || seller.taxId || seller.address) && <section className="contact-seller"><h2>Реквізити продавця</h2>{seller.name && <p>{seller.name}</p>}{seller.taxId && <p>Код: {seller.taxId}</p>}{seller.address && <p>{seller.address}</p>}<Link href="/offer">Публічна оферта</Link></section>}
  </>;
}
