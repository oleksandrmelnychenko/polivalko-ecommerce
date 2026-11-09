import type { CSSProperties } from "react";
import type { TextItem } from "@/features/content/server";
import { ShieldIcon, StoreIcon, TruckIcon, WalletIcon } from "@polivalko/shared/ui/icons";

const ICONS = [TruckIcon, StoreIcon, WalletIcon, ShieldIcon];

const DEFAULT_PERKS: TextItem[] = [
  { title: "Доставка по Україні", text: "Нова пошта: відділення, поштомат або кур'єр. Доставку оплачуєте за тарифами перевізника." },
  { title: "Самовивіз", text: "Безкоштовно. Забирайте, коли менеджер повідомить, що замовлення зібране." },
  { title: "Оплата", text: "Карткою на сайті, післяплатою на Новій пошті або в магазині." },
  { title: "Звіряємо зі складом", text: "Ціну й залишок перевіряємо в магазині до того, як підтвердити замовлення." },
];

export function Perks({ items }: { items?: TextItem[] | null }) {
  const given = items?.filter((p) => p.title?.trim()) ?? [];
  const perks = given.length ? given : DEFAULT_PERKS;
  return (
    <section className="perks" aria-label="Доставка, самовивіз і оплата">
      <div className="container">
        <ul className="perks__list" style={{ "--perks": Math.min(perks.length, 4) } as CSSProperties}>
          {perks.map((p, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <li key={`${i}-${p.title}`}>
                <Icon />
                <h3>{p.title}</h3>
                {p.text && <p>{p.text}</p>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
