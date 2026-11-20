"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { OrderFacts, OrderItems, OrderProgress, OrderReceipts, orderHeading, orderWhere } from "@/features/order";
import { formatDateTime } from "@polivalko/shared/lib/format";
import { getOrder } from "../api/client";
import { useAccountData } from "../hooks/use-account-data";
import { OrderPayment } from "./order-payment";
import { RepeatOrder } from "./repeat-order";
import { RowsSkeleton } from "./rows-skeleton";
import { StateBox } from "./state-box";

async function loadOrder(number: string) {
  const [order, receipts] = await getOrder(number);
  return { data: order.data ? { order: order.data, receipts: receipts.data ?? [] } : undefined, response: order.response };
}

export function OrderDetail() {
  const { number } = useParams<{ number: string }>();
  const returned = useSearchParams().get("payment") === "return";
  const { owner, data, loading, notFound, reload } = useAccountData(`order-${number}`, () => loadOrder(number));

  if (loading) return <RowsSkeleton />;
  if (!data || !owner)
    return (
      <StateBox
        title={notFound ? "Замовлення не знайдено" : "Не вдалося завантажити замовлення"}
        text={notFound ? "Можливо, його оформили з іншого кабінету." : "Перевірте зв'язок і спробуйте ще раз."}
        action={{ href: "/account/orders", label: "До всіх замовлень" }}
      />
    );

  const { order, receipts } = data;
  return (
    <section aria-labelledby="cabinet-title">
      <div className="account-order-head">
        <div className="account-order-head__main">
          <p className="account-back">
            <Link href="/account/orders" className="link">
              Усі замовлення
            </Link>
          </p>
          <h2 id="cabinet-title">
            Замовлення <span className="code">{order.number}</span>
          </h2>
          <p className={order.status === "cancelled" ? "account-order-head__state account-order-head__state--alert" : "account-order-head__state"}>{orderHeading(order)}</p>
          <p className="muted">Оформлено {formatDateTime(order.createdAt)}</p>
          <RepeatOrder owner={owner} order={order} />
        </div>
        <OrderProgress order={order} />
      </div>
      <div className="order-body account-order">
        <div className="order-body__main">
          <OrderPayment owner={owner} order={order} returned={returned} reload={reload} />
          <OrderItems order={order} />
          {receipts.length > 0 && <OrderReceipts receipts={receipts} />}
        </div>
        <aside className="order-body__side">
          <OrderFacts order={order} where={orderWhere(order)} />
        </aside>
      </div>
    </section>
  );
}
