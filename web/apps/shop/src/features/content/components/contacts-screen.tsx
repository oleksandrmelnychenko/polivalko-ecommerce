import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { breadcrumbJsonLd, contactPageJsonLd, JsonLd } from "@/features/seo";
import { getServiceDirections, ServiceRequestForm } from "@/features/services/server";
import { ClockIcon, PhoneIcon, PinIcon, ArrowRightIcon, BagIcon } from "@polivalko/shared/ui/icons";
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
  return <>
    <JsonLd data={contactPageJsonLd({ name: "Контакти", description: "Адреса й графік магазину, телефони для замовлень і послуг.", path: "/contacts", organization: organizationSource(contacts, seller) })} />
    <nav className="crumbs" aria-label="Хлібні крихти"><ol><li><Link href="/">Головна</Link></li><li aria-current="page">Контакти</li></ol></nav>
    <header className="contact-heading"><h1>Контакти</h1><p>Телефони, адреса та графік роботи магазину. Звертайтеся щодо товарів, замовлень і послуг для саду.</p></header>
    <section className="contact-visit" aria-labelledby="visit-address">
      <div className="contact-visit__address"><span className="contact-symbol"><PinIcon /></span><div><p>Адреса магазину</p><h2 id="visit-address">{address}</h2>{mapUrl && <a className="contact-route" href={mapUrl} target="_blank" rel="noopener noreferrer">Прокласти маршрут <ArrowRightIcon /></a>}</div></div>
      <div className="contact-visit__hours"><ClockIcon /><div><h3>Графік роботи</h3>{schedule && <p>{schedule}</p>}<SpecialDays days={contacts?.specialDays} /><span>Самовивіз замовлень — безкоштовно</span></div></div>
    </section>
    <div className="contact-columns">
      <section className="contact-connect" aria-labelledby="contact-connect-title"><h2 id="contact-connect-title">Зв’язок із магазином</h2>
        <div className="contact-phones">
          {contacts?.storePhone && <div><PhoneIcon /><div><h3>Магазин і замовлення</h3><a href={tel(contacts.storePhone)}>{contacts.storePhone}</a><p>Наявність товару, вибір і доставка</p></div></div>}
          {contacts?.servicesPhone && <div><PhoneIcon /><div><h3>Послуги для саду</h3><a href={tel(contacts.servicesPhone)}>{contacts.servicesPhone}</a><p>Озеленення, автополив і догляд</p></div></div>}
        </div>
        {contacts?.email && <a className="contact-email" href={"mailto:" + contacts.email}>{contacts.email}</a>}
        {socials.length > 0 && <div className="contact-social"><h3>Месенджери та соцмережі</h3><nav aria-label="Соціальні мережі"><SocialLinksList links={socials} /></nav></div>}
        <div className="contact-pickup"><BagIcon /><div><h3>Самовивіз замовлень</h3><p>{point?.instructions || "Дочекайтеся повідомлення про готовність і назвіть номер замовлення на касі."}</p>{point?.address && point.address !== address && <p>{point.address}</p>}{point?.schedule && point.schedule !== schedule && <p>{point.schedule}</p>}<Link href="/payment-delivery">Доставка й оплата <ArrowRightIcon /></Link></div></div>
      </section>
      <section id="request" className="contact-form-panel" aria-labelledby="contact-form-title"><h2 id="contact-form-title">Заявка на послугу</h2><p>Оберіть послугу та залиште телефон. Менеджер зв’яжеться з вами, щоб уточнити деталі.</p>{directions.length > 0 ? <ServiceRequestForm directions={directions} className="contact-request-form" /> : <Link href="/services" className="btn">Переглянути послуги</Link>}</section>
    </div>
    {seller && (seller.name || seller.taxId || seller.address) && <section className="contact-seller"><h2>Реквізити продавця</h2>{seller.name && <p>{seller.name}</p>}{seller.taxId && <p>Код: {seller.taxId}</p>}{seller.address && <p>{seller.address}</p>}<Link href="/offer">Публічна оферта</Link></section>}
  </>;
}
