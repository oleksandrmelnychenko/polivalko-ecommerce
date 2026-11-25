import Link from "next/link";
import { connection } from "next/server";
import { getContacts, SpecialDays, type TextItem } from "@/features/content/server";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { directionsUrl } from "@/shared/lib/directions-url";

export async function StoreVisit({ visit }: { visit?: TextItem | null }) {
  await connection();
  const contacts = await getContacts().catch(() => null);
  const route = directionsUrl(contacts?.mapUrl, contacts?.address);

  return (
    <section className="store-visit container" aria-labelledby="visit-title">
      <header className="store-visit__intro">
        <h2 id="visit-title">{visit?.title?.trim() || "Наш магазин"}</h2>
        <Link className="link" href="/contacts">Усі контакти <ArrowRightIcon /></Link>
      </header>
      {visit?.text?.trim() && <p className="store-visit__lead">{visit.text}</p>}
      <div className="store-visit__pickup">
        <div className="store-visit__place">
          {contacts?.address && <div><h3>Адреса</h3><p>{contacts.address}</p></div>}
          {route && <a className="btn" href={route} target="_blank" rel="noopener noreferrer">Прокласти маршрут <ArrowRightIcon /></a>}
          {!contacts?.address && !route && <Link className="link" href="/contacts">Як нас знайти</Link>}
        </div>
        <div className="store-visit__hours">
          {(contacts?.schedule || Boolean(contacts?.specialDays?.length)) && <div>
            <h3>Графік роботи</h3>
            {contacts?.schedule && <p>{contacts.schedule}</p>}
            <SpecialDays days={contacts?.specialDays} limit={3} />
          </div>}
          {contacts?.storePhone && <a href={"tel:" + contacts.storePhone.replace(/[^\d+]/g, "")}>{contacts.storePhone}</a>}
          <p>Забирайте замовлення після повідомлення про готовність.</p>
          <Link className="link" href="/payment-delivery">Про доставку й оплату</Link>
        </div>
      </div>
    </section>
  );
}
