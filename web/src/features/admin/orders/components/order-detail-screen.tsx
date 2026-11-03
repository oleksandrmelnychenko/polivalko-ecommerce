"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAdminData } from "@/shared/admin/use-admin-data";
import { StateBox } from "@/shared/admin/ui/state-box";
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
  const order = useAdminData(number, () => getOrder(number));
  const status = useOrderStatusChange(number, order.setData);

  const o = order.data;

  return (
    <>
      <nav className="crumbs" aria-label="Хлібні крихти">
        <ol>
          <li>
            <Link href="/admin/orders">Замовлення</Link>
          </li>
          <li aria-current="page">{number}</li>
        </ol>
      </nav>
      <StateBox state={order}>
        {o && (
          <>
            <OrderDetailHead order={o} />

            <div className="admin-columns">
              <div className="admin-stack">
                <OrderDetailItems order={o} />

                <OrderDetailHistory order={o} />

                <div className="no-print">
                  <OrderRefunds order={o} onChange={order.setData} />
                  <PaymentsAndReceipts number={o.number} version={`${o.paymentStatus}-${o.refunds.length}-${o.status}`} />
                </div>
              </div>

              <div className="admin-stack">
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
