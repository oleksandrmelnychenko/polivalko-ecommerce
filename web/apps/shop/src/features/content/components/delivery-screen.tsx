import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { ArrowRightIcon, PinIcon, StoreIcon, TruckIcon, WalletIcon } from "@polivalko/shared/ui/icons";
import { SplitHero } from "@/shared/ui/split-hero";
import { getContacts, getDeliveryMethods, getPage, getPickupPoints } from "../api/server";
import { htmlSections } from "../lib/html-sections";

const SLUG = "payment-delivery";
const FALLBACK_TITLE = "Доставка й оплата";
const CARRIER_RATE = "за тарифами перевізника";

type Method = Awaited<ReturnType<typeof getDeliveryMethods>>[number];
type PickupPoint = Awaited<ReturnType<typeof getPickupPoints>>[number];

const PAYMENTS: Record<string, { icon: ReactNode; title: string; text: string }> = {
  card: {
    icon: <WalletIcon />,
    title: "Онлайн карткою",
    text: "На захищеній сторінці платіжної системи. Коли платіж пройде, статус оплати зміниться на сторінці замовлення.",
  },
  cash_on_delivery: {
    icon: <TruckIcon />,
    title: "Післяплата",
    text: "Оплата у відділенні Нової пошти або кур'єру, коли отримуєте посилку.",
  },
  pay_on_pickup: {
    icon: <StoreIcon />,
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
      <SplitHero
        title={title}
        lead={page.lead || "Нова пошта по Україні або самовивіз з магазину. Спосіб отримання й оплати обираєте під час оформлення."}
        icon={<TruckIcon />}
        photo={pagePhotos.collection}
        actions={
          <>
            <Link className="btn" href="/catalog">
              Перейти до каталогу
            </Link>
          </>
        }
      />

      {methods.length > 0 && (
        <section className="ib-section" aria-labelledby="delivery-title">
          <div className="ib-section__head">
            <h2 id="delivery-title">Способи отримання</h2>
            <p>Доставку Новою поштою оплачуєте {CARRIER_RATE}, самовивіз безкоштовний.</p>
          </div>
          <ul className="ib-cards" style={{ "--cols": Math.min(methods.length, 3) } as CSSProperties}>
            {methods.map((method, index) => (
              <DeliveryCard key={method.code} method={method} point={pickupPoints[0]} tint={index % 2 === 0} />
            ))}
          </ul>
        </section>
      )}

      {payments.length > 0 && (
        <section className="ib-section" aria-labelledby="payment-title">
          <div className="ib-section__head">
            <h2 id="payment-title">Способи оплати</h2>
            <p>Під кожним способом указано, з якою доставкою він працює.</p>
          </div>
          <ul className="ib-cards" style={{ "--cols": Math.min(payments.length, 3) } as CSSProperties}>
            {payments.map((code) => (
              <li key={code} className="ib-card">
                <span className="ib-card__icon" aria-hidden="true">
                  {PAYMENTS[code].icon}
                </span>
                <h3>{PAYMENTS[code].title}</h3>
                <p>{PAYMENTS[code].text}</p>
                <ul className="ib-chips" aria-label="Працює з доставкою">
                  {methods
                    .filter((m) => m.paymentMethods.some((p) => p.code === code))
                    .map((m) => (
                      <li key={m.code} className="ib-chip">
                        {shortName(m)}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {terms && (
        <section className="ib-section ib-split" aria-labelledby="terms-title">
          <div className="ib-split__aside">
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

      <section className="ib-band" aria-labelledby="delivery-help-title">
        <div>
          <h2 id="delivery-help-title">Є питання щодо замовлення?</h2>
          <p>{contacts?.storePhone ? `Зателефонуйте в магазин: ${contacts.storePhone}.` : "Телефони й графік магазину є на сторінці контактів."}</p>
        </div>
        <div className="ib-band__actions">
          {contacts?.storePhone && (
            <a className="btn" href={`tel:${contacts.storePhone.replace(/[^\d+]/g, "")}`}>
              Подзвонити
            </a>
          )}
          <Link className="btn btn--outline" href="/contacts">
            Контакти
            <ArrowRightIcon />
          </Link>
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

function DeliveryCard({ method, point, tint }: { method: Method; point?: PickupPoint; tint: boolean }) {
  const pickup = method.code === "pickup";
  const courier = method.code === "nova_poshta_courier";
  const icon = pickup ? <StoreIcon /> : courier ? <PinIcon /> : <TruckIcon />;
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
    <li className={tint ? "ib-card ib-card--tint" : "ib-card"}>
      <span className="ib-card__icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{method.name}</h3>
      <p>{text}</p>
      <dl className="ib-card__meta">
        {facts.map((f) => (
          <div key={f.label}>
            <dt>{f.label}:</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}
