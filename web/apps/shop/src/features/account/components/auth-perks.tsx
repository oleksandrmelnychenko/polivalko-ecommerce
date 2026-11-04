import { CheckIcon } from "@polivalko/shared/ui/icons";

const perks = [
  "Усі замовлення в одному місці: статус, оплата, чеки",
  "Обране: товари, до яких хочеться повернутися",
  "Збережені адреси Нової пошти для швидкого оформлення",
  "Повторне замовлення в один клік",
];

export function AuthPerks() {
  return (
    <aside className="summary auth__perks" aria-labelledby="perks-title">
      <h2 id="perks-title">Що дає кабінет</h2>
      <ul className="auth__list">
        {perks.map((p) => (
          <li key={p}>
            <CheckIcon />
            {p}
          </li>
        ))}
      </ul>
      <p className="field__help">Купувати можна й без реєстрації: кабінет лише робить це зручнішим.</p>
    </aside>
  );
}
