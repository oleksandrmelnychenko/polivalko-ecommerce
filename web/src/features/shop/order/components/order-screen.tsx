import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TrackPurchase } from "@/features/shop/analytics";
import { PaymentPending, PayButton } from "@/features/shop/payment";
import { formatMoney } from "@/shared/lib/format";
import { getOrderAndReceipts } from "../api/server";
import { isOrderPaid, orderHeading, orderWhere } from "../lib/order-view";
import { OrderHead } from "./order-head";
import { OrderHistory } from "./order-history";
import { OrderItems } from "./order-items";
import { OrderReceipts } from "./order-receipts";

type OrderScreenProps = {
  params: Promise<{ number: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function OrderScreen(props: OrderScreenProps) {
  return (
    <div className="container">
      <Suspense fallback={<div className="skeleton" style={{ height: "var(--space-4xl)", marginBlock: "var(--space-2xl)" }} />}>
        <OrderContent {...props} />
      </Suspense>
    </div>
  );
}

async function OrderContent({ params, searchParams }: OrderScreenProps) {
  await connection();
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.token === "string" ? sp.token : "";
  if (!token) notFound();

  const [{ data: order }, { data: receipts }] = await getOrderAndReceipts(number, token);
  if (!order) notFound();

  const returnedFromPayment = sp.payment === "return";
  const where = orderWhere(order);
  const paid = isOrderPaid(order);
  const heading = orderHeading(order, paid);

  return (
    <>
      {(paid || (order.paymentMethod !== "card" && order.status !== "cancelled")) && (
        <TrackPurchase
          orderNumber={order.number}
          items={order.items.map((i) => ({ item_id: i.sku, item_name: i.name, price: Number(i.unitPrice.value), quantity: i.quantity }))}
        />
      )}
      <OrderHead order={order} heading={heading} where={where} />

      <div className="checkout" style={{ paddingTop: "var(--space-2xl)" }}>
        <div className="checkout__form">
          {order.canPay &&
            (returnedFromPayment && order.paymentStatus === "pending" ? (
              <PaymentPending />
            ) : (
              <PayButton number={order.number} token={token} failed={order.paymentStatus === "failed"} amount={formatMoney(order.total)} />
            ))}
          <OrderItems order={order} />

          {receipts && receipts.length > 0 && <OrderReceipts receipts={receipts} />}
        </div>

        <OrderHistory order={order} />
      </div>
    </>
  );
}
