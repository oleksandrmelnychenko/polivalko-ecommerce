"use client";

import { useRef } from "react";
import { useCheckout } from "../hooks/use-checkout";
import { fieldProps } from "../lib/field-props";
import { CheckoutComment } from "./checkout-comment";
import { CheckoutContacts } from "./checkout-contacts";
import { CheckoutDelivery } from "./checkout-delivery";
import { CheckoutEmpty } from "./checkout-empty";
import { CheckoutNotice } from "./checkout-notice";
import { CheckoutPayment } from "./checkout-payment";
import { CheckoutSavedAddresses } from "./checkout-saved-addresses";
import { CheckoutSummary } from "./checkout-summary";

export function CheckoutForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const checkout = useCheckout(formRef);

  if (checkout.lines.length === 0) return <CheckoutEmpty />;

  const { field, fieldError } = fieldProps(checkout.errors);
  const { account } = checkout;

  return (
    <form ref={formRef} className="checkout" onSubmit={checkout.onSubmit} noValidate>
      <div className="checkout__form">
        {checkout.notice && <CheckoutNotice notice={checkout.notice} />}
        <CheckoutContacts field={field} fieldError={fieldError} />
        <CheckoutDelivery
          quote={checkout.quote}
          delivery={checkout.delivery}
          setDelivery={checkout.setDelivery}
          settlement={checkout.settlement}
          chooseSettlement={checkout.chooseSettlement}
          warehouses={checkout.warehouses}
          warehouseRef={checkout.warehouseRef}
          setWarehouseRef={checkout.setWarehouseRef}
          errors={checkout.errors}
          field={field}
          fieldError={fieldError}
          courier={checkout.courier}
          saved={account.addresses.length > 0 && <CheckoutSavedAddresses addresses={account.addresses} chosen={account.chosen} choose={account.choose} />}
          save={
            account.canSave &&
            checkout.delivery !== "pickup" && (
              <label className="consent">
                <input type="checkbox" name="saveAddress" />
                <span>Зберегти адресу в кабінеті</span>
              </label>
            )
          }
        />
        <CheckoutPayment
          paymentOptions={checkout.paymentOptions}
          effectivePayment={checkout.effectivePayment}
          setPayment={checkout.setPayment}
          fieldError={fieldError}
        />
        <CheckoutComment field={field} fieldError={fieldError} />
      </div>

      <CheckoutSummary
        quote={checkout.quote}
        quoteError={checkout.quoteError}
        delivery={checkout.delivery}
        priceNote={checkout.deliveryOption?.priceNote}
        sending={checkout.sending}
        setQuantity={checkout.setQuantity}
        remove={checkout.remove}
      />
    </form>
  );
}
