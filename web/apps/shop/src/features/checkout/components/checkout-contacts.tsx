import type { FieldProps } from "../lib/field-props";

export function CheckoutContacts({ field, fieldError }: FieldProps) {
  return (
    <section aria-labelledby="contacts-title">
      <h2 id="contacts-title">
        <span>1</span> Контакти
      </h2>
      <div className="fields-2">
        <div className="field">
          <label htmlFor="name">Ім&apos;я та прізвище</label>
          <input id="name" name="name" autoComplete="name" required maxLength={100} {...field("customer.name")} />
          {fieldError("customer.name")}
        </div>
        <div className="field">
          <label htmlFor="phone">Телефон</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" spellCheck={false} placeholder="+380 67 123 45 67" required {...field("customer.phone")} />
          {fieldError("customer.phone")}
        </div>
      </div>
      <div className="field">
        <label htmlFor="email">Email, якщо хочете лист про замовлення</label>
        <input id="email" name="email" type="email" autoComplete="email" spellCheck={false} {...field("customer.email")} />
        {fieldError("customer.email")}
      </div>
    </section>
  );
}
