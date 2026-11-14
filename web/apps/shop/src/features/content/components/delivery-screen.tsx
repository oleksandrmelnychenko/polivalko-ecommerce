import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { getContacts, getDeliveryMethods, getPage, getPickupPoints } from "../api/server";
import { htmlSections } from "../lib/html-sections";

const SLUG = "payment-delivery";
const FALLBACK_TITLE = "Доставка й оплата";
const CARRIER_RATE = "за тарифами перевізника";

type Method = Awaited<ReturnType<typeof getDeliveryMethods>>[number];
type PickupPoint = Awaited<ReturnType<typeof getPickupPoints>>[number];

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
      <Suspense fallback={<div className="skeleton" style={{ height: 420, marginBlock: "var(--space-xl)" }} />}>
        <DeliveryContent />
      </Suspense>
    </div>
  );
}

async function DeliveryContent() {
  await connection();
  const [page, methods, pickupPoints, contacts] = await Promise.all([getPage(SLUG), getDeliveryMethods(), getPickupPoints(), getContacts()]);
  if (!page) notFound();
  const title = page.title?.trim() || FALLBACK_TITLE;
  const terms = page.bodyHtml ? htmlSections(page.bodyHtml) : null;
  const payments = [...new Set(methods.flatMap((m) => m.paymentMethods.map((p) => p.code)))].filter((code) => PAYMENTS[code]);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: title, path: `/${SLUG}` }])} />
      <header className="delivery-header">
        <nav className="crumbs" aria-label="Хлібні крихти">
          <ol>
            <li><Link href="/">Головна</Link></li>
            <li aria-current="page">{title}</li>
          </ol>
        </nav>
        <h1>{title}</h1>
        <p>{page.lead || "Нова пошта по Україні або самовивіз з магазину. Спосіб отримання й оплати обираєте під час оформлення."}</p>
      </header>

      {methods.length > 0 && (
        <section className="delivery-section" aria-labelledby="delivery-title">
          <div className="delivery-section__head">
            <h2 id="delivery-title">Способи отримання</h2>
            <p>Доставку Новою поштою оплачуєте {CARRIER_RATE}, самовивіз безкоштовний.</p>
          </div>
          <ul className="delivery-options">
            {methods.map((method) => (
              <DeliveryOption key={method.code} method={method} point={pickupPoints[0]} />
            ))}
          </ul>
        </section>
      )}

      {payments.length > 0 && (
        <section className="delivery-section" aria-labelledby="payment-title">
          <div className="delivery-section__head">
            <h2 id="payment-title">Способи оплати</h2>
          </div>
          <ul className="delivery-options">
            {payments.map((code) => (
              <li key={code} className="delivery-option">
                <h3>{PAYMENTS[code].title}</h3>
                <div className="delivery-option__body">
                  <p>{PAYMENTS[code].text}</p>
                  <p className="delivery-option__availability">
                    Доступно для: {methods
                      .filter((method) => method.paymentMethods.some((payment) => payment.code === code))
                      .map(shortName)
                      .join(", ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {terms && (
        <section className="delivery-section delivery-terms" aria-labelledby="terms-title">
          <div className="delivery-section__head">
            <h2 id="terms-title">Після оформлення</h2>
          </div>
          <div>
            {terms.intro && <div className="prose" dangerouslySetInnerHTML={{ __html: terms.intro }} />}
            {terms.sections.length > 0 && (
              <div className="ib-faq">
                {terms.sections.map((section) => (
                  <details key={section.title}>
                    <summary>{section.title}</summary>
                    <div className="ib-faq__answer prose" dangerouslySetInnerHTML={{ __html: section.html }} />
                  </details>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="delivery-help" aria-labelledby="delivery-help-title">
        <h2 id="delivery-help-title">Є питання щодо замовлення?</h2>
        <div className="delivery-help__links">
          {contacts?.storePhone && (
            <a className="delivery-link" href={`tel:${contacts.storePhone.replace(/[^\d+]/g, "")}`}>
              {contacts.storePhone}
            </a>
          )}
          <Link className="delivery-link" href="/contacts">Контакти магазину</Link>
          <Link className="delivery-link" href="/catalog">Перейти до каталогу</Link>
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

function DeliveryOption({ method, point }: { method: Method; point?: PickupPoint }) {
  const pickup = method.code === "pickup";
  const courier = method.code === "nova_poshta_courier";
  const text = pickup
    ? point?.instructions || "Дочекайтеся повідомлення, що замовлення готове, і заберіть його в магазині."
    : courier
      ? "Кур'єр Нової пошти привезе посилку за вказаною адресою."
      : "Відділення або поштомат у будь-якому місті України. Місто й відділення обираєте під час оформлення.";
  const facts: { label: string; value: string }[] = [];
  if (pickup && point) {
    facts.push({ label: "Адреса", value: point.address });
    facts.push({ label: "Графік", value: point.schedule });
  }
  if (courier && method.description) facts.push({ label: "Зона", value: method.description });
  facts.push({ label: "Вартість", value: pickup ? "безкоштовно" : method.priceNote || CARRIER_RATE });
  facts.push({ label: "Оплата", value: method.paymentMethods.map((p) => p.name).join(", ") });

  return (
    <li className="delivery-option">
      <h3>{method.name}</h3>
      <div className="delivery-option__body">
        <p>{text}</p>
        <dl className="delivery-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </li>
  );
}
