import Link from "next/link";
import { ShieldIcon, StoreIcon, TruckIcon, WalletIcon } from "@polivalko/shared/ui/icons";

export function ProductDeliveryFacts() {
  return (
    <ul className="facts-list buybox__note">
      <li>
        <TruckIcon />
        <span>Нова пошта по Україні за тарифами перевізника: відділення, поштомат або кур&apos;єр</span>
      </li>
      <li>
        <StoreIcon />
        <span>Самовивіз з магазину безкоштовно</span>
      </li>
      <li>
        <WalletIcon />
        <span>Оплата карткою онлайн, післяплатою або в магазині</span>
      </li>
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
