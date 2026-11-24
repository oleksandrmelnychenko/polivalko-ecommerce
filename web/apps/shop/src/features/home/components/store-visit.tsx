import Link from "next/link";
import { directionsUrl } from "@/shared/lib/directions-url";
import { connection } from "next/server";
import { getContacts, SpecialDays, type TextItem } from "@/features/content/server";
import { ArrowRightIcon, ClockIcon, PhoneIcon, PinIcon, BagIcon } from "@polivalko/shared/ui/icons";

export async function StoreVisit({ visit }: { visit?: TextItem | null }) {
  await connection();
  const contacts = await getContacts().catch(() => null);
  const route = directionsUrl(contacts?.mapUrl, contacts?.address);
  return (
    <section className="store-visit container" aria-labelledby="visit-title">
      <div className="store-visit__intro">
        <span className="store-visit__badge"><PinIcon />Магазин у Бучі</span>
        <h2 id="visit-title">{visit?.title?.trim() || "Наш магазин"}</h2>
        <p>{visit?.text?.trim() || "Перегляньте товари в магазині або заберіть онлайн-замовлення без плати за доставку."}</p>
        <Link href="/catalog" className="store-visit__catalog">Обрати товари онлайн <ArrowRightIcon /></Link>
      </div>
      <div className="store-visit__details">
        <div className="store-visit__address"><PinIcon /><div><h3>Адреса</h3><p>{contacts?.address ?? "Буча, Київська область"}</p></div></div>
        <div className="store-visit__contacts">
          {contacts?.schedule && <div><ClockIcon /><div><h3>Графік роботи</h3><p>{contacts.schedule}</p><SpecialDays days={contacts.specialDays} limit={3} /></div></div>}
          {contacts?.storePhone && <div><PhoneIcon /><div><h3>Телефон</h3><a href={"tel:" + contacts.storePhone.replace(/[^\d+]/g, "")}>{contacts.storePhone}</a></div></div>}
        </div>
        <div className="store-visit__actions">
          <Link href="/contacts" className="store-visit__contact-link">Усі контакти <ArrowRightIcon /></Link>
        </div>
      </div>
      <div className="store-visit__pickup">
        <BagIcon />
        <p><strong>Безкоштовний самовивіз</strong><span>Забирайте замовлення після повідомлення про готовність.</span></p>
        <div className="store-visit__pickup-actions">
          {route && <a className="btn" href={route} target="_blank" rel="noopener noreferrer">Прокласти маршрут <ArrowRightIcon /></a>}
          <Link className="link" href="/payment-delivery">Про доставку й оплату</Link>
        </div>
      </div>
    </section>
  );
}
