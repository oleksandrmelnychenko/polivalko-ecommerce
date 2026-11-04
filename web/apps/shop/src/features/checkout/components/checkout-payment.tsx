import type { Quote } from "@polivalko/shared/api/types";
import type { FieldProps } from "../lib/field-props";

type PaymentOption = Quote["deliveryMethods"][number]["paymentMethods"][number];

export function CheckoutPayment({
  paymentOptions,
  effectivePayment,
  setPayment,
  fieldError,
}: Pick<FieldProps, "fieldError"> & {
  paymentOptions: PaymentOption[];
  effectivePayment: string;
  setPayment: (code: string) => void;
}) {
  return (
    <section aria-labelledby="payment-title">
      <h2 id="payment-title">
        <span>3</span> Оплата
      </h2>
      <fieldset className="seg seg--cards">
        <legend className="visually-hidden">Спосіб оплати</legend>
        {paymentOptions.map((p) => (
          <span key={p.code}>
            <input type="radio" id={`payment-${p.code}`} name="payment" value={p.code} checked={effectivePayment === p.code} onChange={() => setPayment(p.code)} />
            <label htmlFor={`payment-${p.code}`}>
              <b>{p.name}</b>
              <small>{p.code === "card" ? "Після створення замовлення" : "Під час отримання"}</small>
            </label>
          </span>
        ))}
      </fieldset>
      {fieldError("payment.method")}
    </section>
  );
}
