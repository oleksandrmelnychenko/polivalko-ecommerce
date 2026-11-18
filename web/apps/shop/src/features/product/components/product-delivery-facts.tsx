import Link from "next/link";
import { carrierPlaces, paymentWords, type DeliveryFacts } from "@/shared/lib/delivery-facts";
import { ShieldIcon, StoreIcon, TruckIcon, WalletIcon } from "@polivalko/shared/ui/icons";

const PAYMENT_WORDS: Record<string, string> = {
  card: "карткою онлайн",
  cash_on_delivery: "післяплатою",
  pay_on_pickup: "в магазині",
};

export async function ProductDeliveryFacts({ load }: { load: () => Promise<DeliveryFacts | null> }) {
  const facts = await load();
  const places = facts ? carrierPlaces(facts) : "";
  const payments = facts ? paymentWords(facts, PAYMENT_WORDS) : "";
  return (
    <ul className="facts-list buybox__note">
      {places && (
        <li>
          <TruckIcon />
          <span>Нова пошта по Україні за тарифами перевізника: {places}</span>
        </li>
      )}
      {facts?.pickup && (
        <li>
          <StoreIcon />
          <span>Самовивіз з магазину безкоштовно</span>
        </li>
      )}
      {payments && (
        <li>
          <WalletIcon />
          <span>Оплата {payments}</span>
        </li>
      )}
      <li>
        <ShieldIcon />
        <span>
          Повернення протягом 14 днів, умови на сторінці{" "}
          <Link href="/returns" className="link">
            «Повернення й обмін»
          </Link>
        </span>
      </li>
    </ul>
  );
}
