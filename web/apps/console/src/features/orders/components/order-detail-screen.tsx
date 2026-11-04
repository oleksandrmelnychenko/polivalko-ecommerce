"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useConsoleData } from "@/shared/use-console-data";
import { StateBox } from "@/shared/ui/state-box";
import { getOrder } from "../api/client";
import { useOrderStatusChange } from "../hooks/use-order-status-change";
import { OrderDetailAccounting } from "./order-detail-accounting";
import { OrderDetailBuyer } from "./order-detail-buyer";
import { OrderDetailHead } from "./order-detail-head";
import { OrderDetailHistory } from "./order-detail-history";
import { OrderDetailItems } from "./order-detail-items";
import { OrderDetailOthers } from "./order-detail-others";
import { OrderDetailStatusPanel } from "./order-detail-status-panel";
import { PaymentsAndReceipts } from "./order-payments-and-receipts";
import { OrderRefunds } from "./order-refunds";

export function OrderDetailScreen() {
  const { number } = useParams<{ number: string }>();
  const order = useConsoleData(number, () => getOrder(number));
  const status = useOrderStatusChange(number, order.setData);

  const o = order.data;

  return (
    <>
      <nav className="crumbs" aria-label="Хлібні крихти">
        <ol>
          <li>
            <Link href="/orders">Замовлення</Link>
          </li>
          <li aria-current="page">{number}</li>
        </ol>
      </nav>
      <StateBox state={order}>
        {o && (
          <>
            <OrderDetailHead order={o} />

            <div className="console-columns">
              <div className="console-stack">
                <OrderDetailItems order={o} />

                <OrderDetailHistory order={o} />

                <div className="no-print">
                  <OrderRefunds order={o} onChange={order.setData} />
                  <PaymentsAndReceipts number={o.number} version={`${o.paymentStatus}-${o.refunds.length}-${o.status}`} />
                </div>
              </div>

              <div className="console-stack">
                <OrderDetailStatusPanel order={o} status={status} />

                <OrderDetailBuyer order={o} />

                <OrderDetailOthers phone={o.phone} current={o.number} />

                <OrderDetailAccounting order={o} />
              </div>
            </div>
          </>
        )}
      </StateBox>
    </>
  );
}
