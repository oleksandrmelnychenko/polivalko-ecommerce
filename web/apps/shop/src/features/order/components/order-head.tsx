import Link from "next/link";
import type { Order } from "@polivalko/shared/api/types";
import { formatDateTime } from "@polivalko/shared/lib/format";
import { paymentStatusLabel } from "@polivalko/shared/lib/labels";
import { AlertIcon, ArrowRightIcon, CheckIcon, ClockIcon } from "@polivalko/shared/ui/icons";
import { OrderProgress } from "./order-progress";

export function OrderHead({ order, heading, mailDelivers }: { order: Order; heading: string; mailDelivers: boolean }) {
  const cancelled = order.status === "cancelled";
  const waiting = order.status === "awaitingConfirmation";
  const tone = cancelled ? "alert" : waiting ? "wait" : "ok";

  return (
    <header className="order-hero">
      <div className="order-hero__top">
        <span className={`order-hero__icon order-hero__icon--${tone}`} aria-hidden="true">
          {cancelled ? <AlertIcon /> : waiting ? <ClockIcon /> : <CheckIcon />}
        </span>
        <div className="order-hero__title">
          <h1>{heading}</h1>
          <p>
            Замовлення <span className="order-hero__number">{order.number}</span> від {formatDateTime(order.createdAt)}
          </p>
        </div>
        <span className="order-payment-status" data-status={order.paymentStatus}>{paymentStatusLabel[order.paymentStatus]}</span>
      </div>
      {waiting && (
        <p className="notice order-hero__notice">
          Ми не змогли звірити ціну й залишок зі складом, тому їх підтвердить менеджер. Оплата карткою стане доступною після цього. Товар уже
          зарезервовано.
        </p>
      )}
      <OrderProgress order={order} />
      <div className="order-hero__foot">
        <p className="order-hero__note">
          {mailDelivers && order.customer.email
            ? `Посилання на замовлення надіслано на ${order.customer.email}.`
            : "Збережіть посилання, щоб перевіряти статус замовлення й переглядати чеки."}
        </p>
        <Link className="order-hero__back" href="/catalog">Продовжити покупки <ArrowRightIcon /></Link>
      </div>
    </header>
  );
}
