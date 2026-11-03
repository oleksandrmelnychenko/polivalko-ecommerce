import { OrderPayments } from "./order-payments";
import { OrderReceipts } from "./order-receipts";

export function PaymentsAndReceipts({ number, version }: { number: string; version: string }) {
  return (
    <>
      <OrderPayments number={number} version={version} />

      <OrderReceipts number={number} version={version} />
    </>
  );
}
