"use client";

import Link from "next/link";
import { useRef } from "react";
import type { PickupPoint } from "@polivalko/shared/api/types";
import { useCustomer } from "@/features/customer";
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

type CheckoutFormProps = { mailDelivers: boolean; phone: string | null; pickupPoint: PickupPoint | null };

export function CheckoutForm(props: CheckoutFormProps) {
  const customer = useCustomer();
  return <CheckoutFields key={customer.me?.id ?? "guest"} {...props} />;
}

function CheckoutFields({ mailDelivers, phone, pickupPoint }: CheckoutFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const checkout = useCheckout(formRef, phone);

  const cartError = checkout.cartError && (
    <p role="alert" className="notice notice--error">
      {checkout.cartError}{" "}
      <button type="button" className="link" onClick={() => void checkout.refreshCart()}>Спробувати ще раз</button>
    </p>
  );
  if (!checkout.ready || checkout.recovering) return cartError || <p role="status">Завантажуємо кошик…</p>;
  if (!checkout.lines.length && cartError) return cartError;
  if (checkout.lines.length === 0) return <CheckoutEmpty />;

  const { field, fieldError } = fieldProps(checkout.errors);
  const { account } = checkout;

  return (
    <form ref={formRef} className="checkout" onSubmit={checkout.onSubmit} noValidate>
      <div className="checkout__form">
        {cartError}
        {checkout.notice && <CheckoutNotice notice={checkout.notice} />}
        <CheckoutContacts field={field} fieldError={fieldError} mailDelivers={mailDelivers} />
        <CheckoutDelivery
          quote={checkout.deliveryQuote}
          delivery={checkout.delivery}
          setDelivery={checkout.setDelivery}
          settlement={checkout.settlement}
          chooseSettlement={checkout.chooseSettlement}
          warehouses={checkout.warehouses}
          warehouseStatus={checkout.warehouseStatus}
          retryWarehouses={checkout.retryWarehouses}
          warehouseRef={checkout.warehouseRef}
          setWarehouseRef={checkout.setWarehouseRef}
          errors={checkout.errors}
          field={field}
          fieldError={fieldError}
          courier={checkout.courier}
          phone={phone}
          pickupPoint={pickupPoint}
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
          unavailable={!!checkout.deliveryOption && checkout.paymentOptions.length === 0}
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
        retryQuote={() => void checkout.refreshQuote()}
        delivery={checkout.delivery}
        priceNote={checkout.deliveryOption?.priceNote}
        sending={checkout.sending}
        canConfirm={checkout.canConfirm}
        rows={checkout.rows}
        setQuantity={checkout.setQuantity}
        remove={checkout.remove}
        consent={
          <div className="co-consent">
            <label className="consent">
              <input type="checkbox" name="acceptOffer" required {...field("acceptOffer")} />
              <span>
                Погоджуюся з{" "}
                <Link href="/offer" className="link" target="_blank">
                  публічною офертою
                </Link>{" "}
                і{" "}
                <Link href="/privacy" className="link" target="_blank">
                  політикою приватності
                </Link>
              </span>
            </label>
            {fieldError("acceptOffer")}
          </div>
        }
      />
    </form>
  );
}
