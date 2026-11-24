import Link from "next/link";
import { carrierPlaces, joinOr, type DeliveryFacts } from "@/shared/lib/delivery-facts";
import { ChevronRightIcon, StoreIcon, TruckIcon } from "@polivalko/shared/ui/icons";

const PAYMENT_WORDS: Record<string, string> = {
  card: "карткою онлайн",
  cash_on_delivery: "післяплатою у відділенні чи кур'єру",
  pay_on_pickup: "під час самовивозу",
};

export function ProductDeliveryFacts({ facts }: { facts: DeliveryFacts }) {
  const places = carrierPlaces(facts);
  const payments = joinOr(facts.payments.map((code) => PAYMENT_WORDS[code]).filter(Boolean));
  return (
    <div className="pinfo">
      {(facts.pickup || places) && (
          <ul className="pinfo__rows">
            {facts.pickup && (
              <li className="pinfo__row">
                <h3><StoreIcon />Самовивіз</h3>
                <p>З магазину після підтвердження готовності замовлення.</p>
                <strong>Безкоштовно</strong>
              </li>
            )}
            {places && (
              <li className="pinfo__row">
                <h3><TruckIcon />Нова пошта</h3>
                <p>{places[0].toUpperCase()}{places.slice(1)} по всій Україні.</p>
                <strong>За тарифом перевізника</strong>
              </li>
            )}
          </ul>
      )}
      {payments && (
        <section className="pinfo__policy">
          <h3>Оплата</h3>
          <p>
            {payments[0].toUpperCase()}
            {payments.slice(1)}.
          </p>
        </section>
      )}
      <section className="pinfo__policy">
        <h3>Повернення</h3>
        <p>Протягом 14 днів. <Link href="/returns">Умови повернення <ChevronRightIcon /></Link></p>
      </section>
    </div>
  );
}
