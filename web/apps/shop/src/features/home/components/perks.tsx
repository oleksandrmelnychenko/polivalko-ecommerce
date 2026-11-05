import type { CSSProperties } from "react";
import type { TextItem } from "@/features/content/server";
import { ShieldIcon, StoreIcon, TruckIcon, WalletIcon } from "@polivalko/shared/ui/icons";

const ICONS = [TruckIcon, StoreIcon, WalletIcon, ShieldIcon];

const DEFAULT_PERKS: TextItem[] = [
  { title: "Доставка по Україні", text: "У відділення, поштомат або кур'єром. Вартість — за тарифами Нової пошти" },
  { title: "Самовивіз у Бучі", text: "Безкоштовно. Приїжджайте, щойно менеджер підтвердить, що замовлення зібране" },
  { title: "Оплата як зручно", text: "Карткою онлайн, післяплатою у відділенні або в магазині" },
  { title: "Ціна без сюрпризів", text: "Перед підтвердженням звіряємо ціну й залишок зі складом магазину" },
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
