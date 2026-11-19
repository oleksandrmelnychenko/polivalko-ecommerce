import { useState } from "react";
import { UserIcon } from "@polivalko/shared/ui/icons";
import type { FieldProps } from "../lib/field-props";
import { CheckoutStep } from "./checkout-step";

export function CheckoutContacts({ field, fieldError, mailDelivers }: FieldProps & { mailDelivers: boolean }) {
  const [otherRecipient, setOtherRecipient] = useState(false);
  return (
    <CheckoutStep id="contacts-title" icon={<UserIcon />} title="Ваші контакти" hint="Зв'яжемося з вами щодо замовлення">
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
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" spellCheck={false} required maxLength={200} {...field("customer.email")} />
        {fieldError("customer.email")}
        <p className="field__help">{mailDelivers ? "Надішлемо посилання на сторінку замовлення: там статус, оплата й чеки." : "Для зв'язку щодо замовлення."}</p>
      </div>
      <div className="co-recipient">
        <label className="consent co-recipient__toggle">
          <input type="checkbox" name="otherRecipient" checked={otherRecipient} onChange={event => setOtherRecipient(event.target.checked)} aria-controls="recipient-fields" aria-expanded={otherRecipient} />
          <span>Замовлення отримає інша людина</span>
        </label>
        <fieldset id="recipient-fields" className="co-recipient__fields" hidden={!otherRecipient} disabled={!otherRecipient}>
          <legend>Контакти отримувача</legend>
          <p className="field__help">Ці дані використаємо для доставки або видачі замовлення.</p>
          <div className="fields-2">
            <div className="field"><label htmlFor="recipientName">Ім’я та прізвище отримувача</label><input id="recipientName" name="recipientName" autoComplete="section-recipient shipping name" required maxLength={100} {...field("recipient.name")} />{fieldError("recipient.name")}</div>
            <div className="field"><label htmlFor="recipientPhone">Телефон отримувача</label><input id="recipientPhone" name="recipientPhone" type="tel" inputMode="tel" autoComplete="section-recipient shipping tel" required placeholder="+380 67 123 45 67" {...field("recipient.phone")} />{fieldError("recipient.phone")}</div>
          </div>
        </fieldset>
      </div>
    </CheckoutStep>
  );
}
