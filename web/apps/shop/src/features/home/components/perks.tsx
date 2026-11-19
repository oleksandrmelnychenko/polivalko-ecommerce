import type { CSSProperties } from "react";
import type { TextItem } from "@/features/content/server";
import { carrierPlaces, paymentWords, type DeliveryFacts } from "@/shared/lib/delivery-facts";
import { ShieldIcon, StoreIcon, TruckIcon, WalletIcon } from "@polivalko/shared/ui/icons";

const ICONS = [TruckIcon, StoreIcon, WalletIcon, ShieldIcon];

type Perk = TextItem & { icon?: typeof TruckIcon };

const PAYMENT_WORDS: Record<string, string> = {
  card: "карткою на сайті",
  cash_on_delivery: "післяплатою на Новій пошті",
  pay_on_pickup: "в магазині",
};

function defaultPerks(facts: DeliveryFacts | null): Perk[] {
  if (!facts) return [];
  const places = carrierPlaces(facts);
  const payments = paymentWords(facts, PAYMENT_WORDS);
  const perks: Perk[] = [];
  if (places) perks.push({ title: "Доставка по Україні", text: `Нова пошта: ${places}. Доставку оплачуєте за тарифами перевізника.`, icon: TruckIcon });
  if (facts.pickup) perks.push({ title: "Самовивіз", text: "Безкоштовно. Забирайте, коли менеджер повідомить, що замовлення зібране.", icon: StoreIcon });
  if (payments) perks.push({ title: "Оплата", text: `${payments[0].toUpperCase()}${payments.slice(1)}.`, icon: WalletIcon });
  if (perks.length === 0) return [];
  return [...perks, { title: "Підтвердження замовлення", text: "Перед підтвердженням перевіряємо ціну й наявність товарів.", icon: ShieldIcon }];
}

export function Perks({ items, facts }: { items?: TextItem[] | null; facts: DeliveryFacts | null }) {
  const given = items?.filter((p) => p.title?.trim()) ?? [];
  const perks: Perk[] = given.length ? given : defaultPerks(facts);
  if (perks.length === 0) return null;
  return (
    <section className="perks" aria-label="Доставка, самовивіз і оплата">
      <div className="container">
        <ul className="perks__list" style={{ "--perks": Math.min(perks.length, 4) } as CSSProperties}>
          {perks.map((p, i) => {
            const Icon = p.icon ?? ICONS[i % ICONS.length];
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
