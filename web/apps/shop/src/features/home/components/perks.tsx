import { ShieldIcon, StoreIcon, TruckIcon, WalletIcon } from "@polivalko/shared/ui/icons";

export function Perks() {
  const perks = [
    { icon: <TruckIcon />, title: "Доставка по Україні", text: "У відділення, поштомат або кур'єром. Вартість — за тарифами Нової пошти" },
    { icon: <StoreIcon />, title: "Самовивіз у Бучі", text: "Безкоштовно. Приїжджайте, щойно менеджер підтвердить, що замовлення зібране" },
    { icon: <WalletIcon />, title: "Оплата як зручно", text: "Карткою онлайн, післяплатою у відділенні або в магазині" },
    { icon: <ShieldIcon />, title: "Ціна без сюрпризів", text: "Перед підтвердженням звіряємо ціну й залишок зі складом магазину" },
  ];
  return (
    <section className="perks" aria-label="Доставка, самовивіз і оплата">
      <div className="container">
        <ul className="perks__list">
          {perks.map((p) => (
            <li key={p.title}>
              {p.icon}
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
