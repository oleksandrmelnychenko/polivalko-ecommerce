import Link from "next/link";
import { connection } from "next/server";
import { getContacts } from "@/features/shop/content/server";
import { sized } from "@/shared/lib/images";
import { pagePhotos } from "@/shared/lib/stand-in-photos";
import { ArrowRightIcon, ClockIcon, PhoneIcon, PinIcon } from "@/shared/ui/icons";
import { Heading } from "./heading";

export async function StoreVisit() {
  await connection();
  const contacts = await getContacts();
  return (
    <section className="visit" aria-labelledby="visit-title">
      <div className="container visit__inner">
        <div className="visit__copy">
          <Heading id="visit-title" title="Магазин у Бучі" sub="Подивіться товар наживо й заберіть замовлення" />
          <ul className="visit__facts">
            <li>
              <PinIcon />
              <span>{contacts?.address ?? <span className="fill">Буча, адреса уточнюється</span>}</span>
            </li>
            <li>
              <ClockIcon />
              <span>{contacts?.schedule ?? <span className="fill">графік уточнюється</span>}</span>
            </li>
            {contacts?.storePhone && (
              <li>
                <PhoneIcon />
                <a href={`tel:${contacts.storePhone.replace(/[^\d+]/g, "")}`}>{contacts.storePhone}</a>
              </li>
            )}
          </ul>
          <p className="visit__actions">
            <Link href="/contacts" className="btn">
              Контакти й маршрут
              <ArrowRightIcon />
            </Link>
            <Link href="/payment-delivery" className="btn btn--outline">
              Доставка й оплата
            </Link>
          </p>
        </div>
        <figure className="visit__photo">
          <img {...sized(pagePhotos.store.url, "(max-width: 60rem) 100vw, 600px", 960)} alt={pagePhotos.store.alt} width={960} height={720} loading="lazy" fetchPriority="low" decoding="async" />
        </figure>
      </div>
    </section>
  );
}
