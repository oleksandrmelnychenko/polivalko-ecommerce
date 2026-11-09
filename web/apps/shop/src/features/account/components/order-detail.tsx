"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { OrderFacts, OrderHistory, OrderItems, OrderReceipts, orderWhere } from "@/features/order";
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
  const { data, loading, notFound, reload } = useAccountData(`order-${number}`, () => loadOrder(number));

  if (loading) return <RowsSkeleton />;
  if (!data)
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
      <div className="order-head account-order-head">
        <div>
          <p className="account-back">
            <Link href="/account/orders" className="link">
              Усі замовлення
            </Link>
          </p>
          <h2 id="cabinet-title">
            Замовлення <span className="code">{order.number}</span>
          </h2>
          <p className="muted">Оформлено {formatDateTime(order.createdAt)}</p>
          <RepeatOrder order={order} />
        </div>
        <OrderFacts order={order} where={orderWhere(order)} />
      </div>
      <div className="checkout account-order">
        <div className="checkout__form">
          <OrderPayment order={order} returned={returned} reload={reload} />
          <OrderItems order={order} />
          {receipts.length > 0 && <OrderReceipts receipts={receipts} />}
        </div>
        <OrderHistory order={order} />
      </div>
    </section>
  );
}
