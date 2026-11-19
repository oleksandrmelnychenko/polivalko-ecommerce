import { CheckIcon } from "@polivalko/shared/ui/icons";

const perks = [
  "Історія замовлень зі статусом оплати й чеками",
  "Збережені товари в обраному",
  "Збережені адреси для наступних замовлень",
  "Попереднє замовлення можна повторити однією кнопкою",
];

export function AuthPerks() {
  return (
    <aside className="summary auth__perks" aria-labelledby="perks-title">
      <h2 id="perks-title">Можливості кабінету</h2>
      <ul className="auth__list">
        {perks.map((p) => (
          <li key={p}>
            <CheckIcon />
            {p}
          </li>
        ))}
      </ul>
      <p className="field__help">Замовити можна й без реєстрації.</p>
    </aside>
  );
}
