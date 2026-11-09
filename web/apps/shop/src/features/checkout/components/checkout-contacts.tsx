import { UserIcon } from "@polivalko/shared/ui/icons";
import type { FieldProps } from "../lib/field-props";
import { CheckoutStep } from "./checkout-step";

export function CheckoutContacts({ field, fieldError }: FieldProps) {
  return (
    <CheckoutStep id="contacts-title" icon={<UserIcon />} title="Контакти" hint="Для доставки й зв'язку щодо замовлення">
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
        <label htmlFor="email">
          Email <span className="field__optional">необов&apos;язково, для листа про замовлення</span>
        </label>
        <input id="email" name="email" type="email" autoComplete="email" spellCheck={false} {...field("customer.email")} />
        {fieldError("customer.email")}
      </div>
    </CheckoutStep>
  );
}
