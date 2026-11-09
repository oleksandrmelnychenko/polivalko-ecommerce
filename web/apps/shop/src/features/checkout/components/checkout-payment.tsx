import type { ReactNode } from "react";
import type { Quote } from "@polivalko/shared/api/types";
import { StoreIcon, TruckIcon, WalletIcon } from "@polivalko/shared/ui/icons";
import type { FieldProps } from "../lib/field-props";
import { CheckoutOptions } from "./checkout-options";
import { CheckoutStep } from "./checkout-step";

type PaymentOption = Quote["deliveryMethods"][number]["paymentMethods"][number];

const PAYMENT: Record<string, { icon: ReactNode; note: string }> = {
  card: { icon: <WalletIcon />, note: "Одразу після оформлення" },
  cash_on_delivery: { icon: <TruckIcon />, note: "Під час отримання посилки" },
  pay_on_pickup: { icon: <StoreIcon />, note: "Коли забираєте замовлення" },
};

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
  const options = paymentOptions.map((p) => ({
    code: p.code,
    title: p.name,
    icon: PAYMENT[p.code]?.icon ?? <WalletIcon />,
    notes: [PAYMENT[p.code]?.note ?? ""],
  }));

  return (
    <CheckoutStep id="payment-title" icon={<WalletIcon />} title="Оплата" hint="Способи залежать від обраної доставки">
      <CheckoutOptions name="payment" legend="Спосіб оплати" options={options} value={effectivePayment} onChange={setPayment} />
      {fieldError("payment.method")}
    </CheckoutStep>
  );
}
