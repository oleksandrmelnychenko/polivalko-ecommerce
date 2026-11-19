import Link from "next/link";
import { carrierPlaces, joinOr, type DeliveryFacts } from "@/shared/lib/delivery-facts";
import { StoreIcon, TruckIcon } from "@polivalko/shared/ui/icons";

const PAYMENT_WORDS: Record<string, string> = {
  card: "карткою онлайн",
  cash_on_delivery: "післяплатою у відділенні чи кур'єру",
  pay_on_pickup: "під час самовивозу",
};

export async function ProductDeliveryFacts({ load }: { load: () => Promise<DeliveryFacts | null> }) {
  const facts = await load();
  if (!facts) return null;
  const places = carrierPlaces(facts);
  const payments = joinOr(facts.payments.map((code) => PAYMENT_WORDS[code]).filter(Boolean));
  return (
    <>
      {(facts.pickup || places) && (
        <section className="pinfo" aria-labelledby="pinfo-delivery">
          <h2 id="pinfo-delivery" className="pinfo__title">
            Доставка
          </h2>
          <ul className="pinfo__rows">
            {facts.pickup && (
              <li className="pinfo__row">
                <StoreIcon />
                <p>
                  Самовивіз
                  <small>З магазину, коли менеджер повідомить, що замовлення зібране</small>
                </p>
                <span>Безкоштовно</span>
              </li>
            )}
            {places && (
              <li className="pinfo__row">
                <TruckIcon />
                <p>
                  Нова пошта
                  <small>
                    {places[0].toUpperCase()}
                    {places.slice(1)} по всій Україні
                  </small>
                </p>
                <span>За тарифом</span>
              </li>
            )}
          </ul>
        </section>
      )}
      {payments && (
        <section className="pinfo" aria-labelledby="pinfo-payment">
          <h2 id="pinfo-payment" className="pinfo__title">
            Оплата
          </h2>
          <p className="pinfo__text">
            {payments[0].toUpperCase()}
            {payments.slice(1)}.
          </p>
        </section>
      )}
      <p className="pinfo__text">
        Повернення протягом 14 днів, умови на сторінці{" "}
        <Link href="/returns" className="link">
          «Повернення й обмін»
        </Link>
        .
      </p>
    </>
  );
}
