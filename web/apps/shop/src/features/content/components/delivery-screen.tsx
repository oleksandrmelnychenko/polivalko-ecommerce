import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowRightIcon, StoreIcon } from "@polivalko/shared/ui/icons";
import { directionsUrl } from "@/shared/lib/directions-url";
import { getContacts, getDeliveryMethods, getPage, getPickupPoints } from "../api/server";
import { htmlSections } from "../lib/html-sections";
import { PageHead } from "./page-head";

const SLUG = "payment-delivery";
const FALLBACK_TITLE = "Доставка й оплата";
const FALLBACK_LEAD = "Як отримати й оплатити замовлення?";
const CARRIER_RATE = "за тарифами перевізника";

type Method = Awaited<ReturnType<typeof getDeliveryMethods>>[number];
type PickupLocation = { address?: string | null; schedule?: string | null; mapUrl?: string | null; instructions?: string | null };

const PAYMENTS: Record<string, { title: string; text: string }> = {
  card: {
    title: "Онлайн карткою",
    text: "На захищеній сторінці платіжної системи. Коли платіж пройде, статус оплати зміниться на сторінці замовлення.",
  },
  cash_on_delivery: {
    title: "Післяплата",
    text: "Оплата у відділенні Нової пошти або кур'єру, коли отримуєте посилку.",
  },
  pay_on_pickup: {
    title: "У магазині",
    text: "Оплата в магазині, коли забираєте замовлення.",
  },
};

export function DeliveryScreen() {
  return (
    <div className="container delivery-page">
      <PageHead
        path="/payment-delivery"
        title={FALLBACK_TITLE}
        lead={FALLBACK_LEAD}
        actions={<a href="#delivery-title" className="btn btn--graphite">Способи отримання</a>}
      >
        <Suspense fallback={<div className="doc__loading" role="status">Завантажуємо умови доставки й оплати…</div>}>
          <DeliveryContent />
        </Suspense>
      </PageHead>
    </div>
  );
}

async function DeliveryContent() {
  await connection();
  const [page, methods, pickupPoints, contacts] = await Promise.all([
    getPage(SLUG),
    getDeliveryMethods().catch(() => []),
    getPickupPoints().catch(() => []),
    getContacts().catch(() => null),
  ]);
  if (!page) notFound();
  const terms = page.bodyHtml ? htmlSections(page.bodyHtml) : null;
  const store = pickupPoints.find((point) => point.code === "bucha-store") ?? pickupPoints[0];
  const location: PickupLocation = store ?? contacts ?? {};
  const orderedMethods = methods.toSorted((a, b) => Number(b.code === "pickup") - Number(a.code === "pickup"));
  const payments = [...new Set(methods.flatMap((m) => m.paymentMethods.map((p) => p.code)))].filter((code) => PAYMENTS[code]);

  return (
    <>
      <div className="leaf-separated">
        {methods.length > 0 && (
          <section className="delivery-section" aria-labelledby="delivery-title">
            <h2 id="delivery-title">Способи отримання</h2>
            <ul className="delivery-options">
              {orderedMethods.map((method) => (
                <DeliveryOption key={method.code} method={method} location={location} />
              ))}
            </ul>
          </section>
        )}

        {payments.length > 0 && (
          <section className="delivery-section" aria-labelledby="payment-title">
            <h2 id="payment-title">Способи оплати</h2>
            <ul className="payment-list">
              {payments.map((code) => (
                <li key={code}>
                  <h3>{PAYMENTS[code].title}</h3>
                  <div className="delivery-option__body">
                    <p>{PAYMENTS[code].text}</p>
                    <ul className="payment-availability" aria-label="Для яких способів отримання">
                      {methods.filter(method => method.paymentMethods.some(payment => payment.code === code))
                        .map(method => <li key={method.code}>{shortName(method)}</li>)}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {terms && (
          <section className="delivery-section delivery-terms" aria-labelledby="terms-title">
            <h2 id="terms-title">Після оформлення</h2>
            <div className="delivery-terms__items">
              {terms.intro && <div className="prose" dangerouslySetInnerHTML={{ __html: terms.intro }} />}
              {terms.sections.map((section, index) => (
                <div key={index}>
                  <h3>{section.title}</h3>
                  <div className="prose" dangerouslySetInnerHTML={{ __html: section.html }} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <section className="delivery-help" aria-labelledby="delivery-help-title">
        <h2 id="delivery-help-title">Є питання щодо замовлення?</h2>
        <div className="delivery-help__links">
          {contacts?.storePhone && (
            <a className="delivery-link" href={`tel:${contacts.storePhone.replace(/[^\d+]/g, "")}`}>
              {contacts.storePhone}
            </a>
          )}
          <Link className="delivery-link" href="/contacts">Контакти магазину</Link>
          <Link className="delivery-link" href="/returns">Повернення й обмін</Link>
          <Link className="delivery-link" href="/catalog">Каталог</Link>
        </div>
      </section>
    </>
  );
}

function shortName(method: Method): string {
  if (method.code === "nova_poshta") return "Нова пошта";
  if (method.code === "nova_poshta_courier") return "Кур'єр";
  if (method.code === "pickup") return "Самовивіз";
  return method.name;
}

function DeliveryOption({ method, location }: { method: Method; location: PickupLocation }) {
  const pickup = method.code === "pickup";
  const courier = method.code === "nova_poshta_courier";
  const route = pickup ? directionsUrl(location.mapUrl, location.address) : null;
  const text = pickup
    ? location.instructions || "Дочекайтеся повідомлення, що замовлення готове, і заберіть його в магазині."
    : courier
      ? "Кур'єр Нової пошти привезе посилку за вказаною адресою."
      : method.code === "nova_poshta"
        ? "Оберіть населений пункт і відділення або поштомат під час оформлення."
        : method.description;
  const facts: { label: string; value: string }[] = [];
  if (pickup && location.address) facts.push({ label: "Адреса", value: location.address });
  if (pickup && location.schedule) facts.push({ label: "Графік", value: location.schedule });
  if (courier && method.description) facts.push({ label: "Зона", value: method.description });

  return (
    <li className={pickup ? "delivery-option delivery-option--pickup" : "delivery-option"}>
      <div className="delivery-option__head">
        {pickup ? <StoreIcon /> : (courier || method.code === "nova_poshta") && <img src="/brand/nova-poshta.svg" width={20} height={20} alt="" aria-hidden="true" />}
        <h3>{method.name}</h3>
      </div>
      <span className="delivery-option__rate">{method.priceNote || (pickup ? "Безкоштовно" : CARRIER_RATE)}</span>
      <div className="delivery-option__body">
        {text && <p>{text}</p>}
        {facts.length > 0 && <dl className="delivery-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>}
        {route && <a className="delivery-route" href={route} target="_blank" rel="noopener noreferrer">Прокласти маршрут <ArrowRightIcon /></a>}
      </div>
    </li>
  );
}
