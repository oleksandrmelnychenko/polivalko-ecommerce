import { notFound } from "next/navigation";
import { connection } from "next/server";
import { TrackPurchase } from "@/features/analytics";
import { PaymentPending, PayButton } from "@/features/payment";
import { formatMoney } from "@polivalko/shared/lib/format";
import { getOrderAndReceipts } from "../api/server";
import { isOrderPaid, orderHeading, orderWhere } from "../lib/order-view";
import { OrderFacts } from "./order-facts";
import { OrderHead } from "./order-head";
import { OrderItems } from "./order-items";
import { OrderReceipts } from "./order-receipts";

type OrderScreenProps = {
  params: Promise<{ number: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  mailDelivers: () => Promise<boolean>;
};

const NOT_FOUND_STATUSES = [400, 401, 403, 404];

/**
 * Loads the order before anything streams, so an unknown number or a wrong token answers a real 404
 * (inside Suspense the status would already be 200). The page opts into blocking with `instant = false`.
 */
export async function OrderScreen({ params, searchParams, mailDelivers }: OrderScreenProps) {
  await connection();
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.token === "string" ? sp.token : "";
  if (!token) notFound();

  const [[{ data: order, response }, receipts], mail] = await Promise.all([getOrderAndReceipts(number, token), mailDelivers()]);
  if (!order) {
    if (NOT_FOUND_STATUSES.includes(response.status)) notFound();
    throw new Error(`API: не вдалося завантажити замовлення, статус ${response.status}`);
  }

  const returnedFromPayment = sp.payment === "return";
  const where = orderWhere(order);
  const paid = isOrderPaid(order);
  const payButton = <PayButton number={order.number} token={token} failed={order.paymentStatus === "failed"} amount={formatMoney(order.total)} />;

  return (
    <div className="container order-page">
      {(paid || (order.paymentMethod !== "card" && order.status !== "cancelled")) && (
        <TrackPurchase
          orderNumber={order.number}
          items={order.items.map((i) => ({ item_id: i.sku, item_name: i.name, price: Number(i.unitPrice.value), quantity: i.quantity }))}
        />
      )}
      <OrderHead order={order} heading={orderHeading(order)} mailDelivers={mail} />

      <div className="order-body">
        <div className="order-body__main">
          {order.canPay && (returnedFromPayment && order.paymentStatus === "pending" ? <PaymentPending>{payButton}</PaymentPending> : payButton)}
          <OrderItems order={order} />

          {receipts && receipts.length > 0 && <OrderReceipts receipts={receipts} />}
        </div>

        <aside className="order-body__side">
          <OrderFacts order={order} where={where} />
        </aside>
      </div>
    </div>
  );
}
