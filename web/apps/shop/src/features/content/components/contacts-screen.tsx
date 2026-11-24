import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { breadcrumbJsonLd, contactPageJsonLd, JsonLd } from "@/features/seo";
import { getServiceDirections, ServiceRequestForm } from "@/features/services/server";
import { ArrowRightIcon, PhoneIcon } from "@polivalko/shared/ui/icons";
import { getContacts, getPickupPoints, getSeller } from "../api/server";
import { organizationSource } from "../lib/organization";
import { socialLinks } from "../lib/social-links";
import { SpecialDays } from "./special-days";
import { SocialLinksList } from "./social-links";

const tel = (value: string) => "tel:" + value.replace(/[^\d+]/g, "");
export function ContactsScreen() {
  return <div className="container contact-page"><JsonLd data={breadcrumbJsonLd([{ name: "Контакти", path: "/contacts" }])} /><Suspense fallback={<div className="skeleton" style={{ height: 680, marginBlock: 64 }} />}><ContactsContent /></Suspense></div>;
}
async function ContactsContent() {
  await connection();
  const [contacts, points, seller, directions] = await Promise.all([getContacts(), getPickupPoints().catch(()=>[]), getSeller().catch(()=>null), getServiceDirections().catch(()=>[])]);
  const point = points[0];
  const address = contacts?.address || point?.address || "Буча, Київська область";
  const schedule = contacts?.schedule || point?.schedule;
  const mapUrl = contacts?.mapUrl || point?.mapUrl;
  const socials = socialLinks(contacts);
  const hasServices = Boolean(directions.length || contacts?.servicesPhone);
  const requestIntro = (
    <header className="contact-request-intro">
      <h2 id="contact-services-title">{directions.length ? "Заявка на садові роботи" : "Послуги для саду"}</h2>
      {contacts?.servicesPhone && <a className="contact-service-phone" href={tel(contacts.servicesPhone)}><PhoneIcon />{contacts.servicesPhone}</a>}
    </header>
  );
  const mapQuery = (mapUrl && URL.canParse(mapUrl) && new URL(mapUrl).searchParams.get("query")) || address;
  const mapEmbed = "https://maps.google.com/maps?" + new URLSearchParams({ q: mapQuery, z: "16", hl: "uk", output: "embed" });
  return <>
    <JsonLd data={contactPageJsonLd({ name: "Контакти", description: "Адреса й графік магазину, телефони для замовлень і послуг.", path: "/contacts", organization: organizationSource(contacts, seller) })} />
    <header className="contact-heading" id="store"><h1>Контакти</h1></header>
    <section className="contact-panel" aria-labelledby="contact-store-title">
      <div className="contact-info">
        <h2 id="contact-store-title">Адреса магазину</h2>
        <p className="contact-address">{address}</p>
        {mapUrl && <a className="contact-route" href={mapUrl} target="_blank" rel="noopener noreferrer">Прокласти маршрут <ArrowRightIcon /></a>}
        <dl className="contact-facts">
          {contacts?.storePhone && <div><dt>Магазин і замовлення</dt><dd><a href={tel(contacts.storePhone)}>{contacts.storePhone}</a></dd></div>}
          {(schedule || contacts?.specialDays?.length) ? <div><dt>Графік роботи</dt><dd>{schedule}<SpecialDays days={contacts?.specialDays} /></dd></div> : null}
          {contacts?.email && <div><dt>Email</dt><dd><a href={"mailto:" + contacts.email}>{contacts.email}</a></dd></div>}
        </dl>
        <div className="contact-pickup">
          <p>Самовивіз безкоштовний. {point?.instructions || "Дочекайтеся повідомлення про готовність і назвіть номер замовлення на касі."}</p>
          {point?.address && point.address !== address && <p>{point.address}</p>}
          {point?.schedule && point.schedule !== schedule && <p>{point.schedule}</p>}
          <Link href="/payment-delivery">Доставка й оплата</Link>
        </div>
      </div>
      {(contacts?.address || point?.address) && <iframe className="contact-map" src={mapEmbed} title="Магазин на карті" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />}
    </section>
    {socials.length > 0 && <nav className="contact-social" aria-label="Месенджери та соцмережі"><SocialLinksList links={socials} /></nav>}
    {hasServices && (
      <section id="request" className="contact-request-sheet" aria-labelledby="contact-services-title">
        {directions.length > 0 ? <ServiceRequestForm directions={directions} intro={requestIntro} /> : requestIntro}
      </section>
    )}
    {seller && (seller.name || seller.taxId || seller.address) && <section className="contact-seller"><h2>Реквізити продавця</h2>{seller.name && <p>{seller.name}</p>}{seller.taxId && <p>Код: {seller.taxId}</p>}{seller.address && <p>{seller.address}</p>}<Link href="/offer">Публічна оферта</Link></section>}
  </>;
}
