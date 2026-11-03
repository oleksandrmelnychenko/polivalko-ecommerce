import { orderStatusLabel, paymentStatusLabel } from "@/shared/lib/labels";
import { paymentTone, statusTone } from "../lib/tones";
import type { OrderRow } from "../lib/types";

export function StatusText({ status }: { status: OrderRow["status"] }) {
  return <span className={`chip chip--${statusTone[status]}`}>{orderStatusLabel[status]}</span>;
}

export function PaymentStatusText({ status }: { status: OrderRow["paymentStatus"] }) {
  return <span className={`chip chip--${paymentTone[status]}`}>{paymentStatusLabel[status]}</span>;
}
