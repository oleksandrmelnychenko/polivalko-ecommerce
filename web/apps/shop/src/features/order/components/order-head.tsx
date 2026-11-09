import Link from "next/link";
import type { Order } from "@polivalko/shared/api/types";
import { AlertIcon, ArrowRightIcon, CheckIcon, ClockIcon } from "@polivalko/shared/ui/icons";
import { OrderFacts } from "./order-facts";

export function OrderHead({ order, heading, where }: { order: Order; heading: string; where: string }) {
  const cancelled = order.status === "cancelled";
  const waiting = order.status === "awaitingConfirmation";
  const tone = cancelled ? "alert" : waiting ? "wait" : "ok";

  return (
    <header className="order-head">
      <div className="order-head__main">
        <span className={`order-head__icon order-head__icon--${tone}`} aria-hidden="true">
          {cancelled ? <AlertIcon /> : waiting ? <ClockIcon /> : <CheckIcon />}
        </span>
        <h1>{heading}</h1>
        <p className="order-head__number">
          Замовлення <span className="code">{order.number}</span>
        </p>
        <p className="order-head__note">На цій сторінці видно статус замовлення, оплату й чеки. Збережіть посилання на неї.</p>
        {waiting && (
          <p className="notice">
            Ми не змогли звірити ціну й залишок зі складом, тому їх підтвердить менеджер. Оплата карткою стане доступною після цього. До
            підтвердження товар не резервується.
          </p>
        )}
        <Link className="order-head__back" href="/catalog">
          Продовжити покупки
          <ArrowRightIcon />
        </Link>
      </div>
      <OrderFacts order={order} where={where} />
    </header>
  );
}
