import type { ReactNode } from "react";
import type { Quote } from "@polivalko/shared/api/types";
import { PhoneIcon, StoreIcon, TruckIcon, WalletIcon } from "@polivalko/shared/ui/icons";
import type { FieldProps } from "../lib/field-props";
import { CheckoutOptions, type CheckoutOption } from "./checkout-options";
import { CheckoutStep } from "./checkout-step";

type PaymentOption = Quote["deliveryMethods"][number]["paymentMethods"][number];

const PAYMENT: Record<string, { icon: ReactNode; note: string }> = {
  card: { icon: <WalletIcon />, note: "Одразу після оформлення" },
  cash_on_delivery: { icon: <TruckIcon />, note: "Під час отримання посилки" },
  pay_on_pickup: { icon: <StoreIcon />, note: "Коли забираєте замовлення" },
};

const CARD_PREFIX = "card:";

export function CheckoutPayment({
  unavailable,
  paymentOptions,
  effectivePayment,
  setPayment,
  cardProvider,
  setCardProvider,
  fieldError,
}: Pick<FieldProps, "fieldError"> & {
  unavailable: boolean;
  paymentOptions: PaymentOption[];
  effectivePayment: string;
  setPayment: (code: string) => void;
  cardProvider: string | null;
  setCardProvider: (code: string) => void;
}) {
  // Online payment opens as one row per bank, so the buyer picks monobank, PrivatBank or Apple Pay / Google Pay here.
  const options: CheckoutOption[] = paymentOptions.flatMap((p): CheckoutOption[] =>
    p.code === "card" && p.providers?.length
      ? p.providers.map((provider) => ({
          code: `${CARD_PREFIX}${provider.code}`,
          title: provider.code === "wallet" ? provider.name : `Онлайн: ${provider.name}`,
          icon: provider.code === "wallet" ? <PhoneIcon /> : <WalletIcon />,
          notes: [provider.hint, "Одразу після оформлення"],
        }))
      : [{ code: p.code, title: p.name, icon: PAYMENT[p.code]?.icon ?? <WalletIcon />, notes: [PAYMENT[p.code]?.note ?? ""] }],
  );
  const value = effectivePayment === "card" && cardProvider && options.some((o) => o.code === `${CARD_PREFIX}${cardProvider}`) ? `${CARD_PREFIX}${cardProvider}` : effectivePayment;

  function choose(code: string) {
    if (code.startsWith(CARD_PREFIX)) {
      setPayment("card");
      setCardProvider(code.slice(CARD_PREFIX.length));
    } else {
      setPayment(code);
    }
  }

  return (
    <CheckoutStep id="payment-title" icon={<WalletIcon />} title="Оплата" hint="Способи залежать від обраної доставки">
      <CheckoutOptions name="payment" legend="Спосіб оплати" options={options} value={value} onChange={choose} />
      {unavailable && <p className="notice">Для цього способу отримання оплата зараз недоступна.</p>}
      {fieldError("payment.method")}
    </CheckoutStep>
  );
}
