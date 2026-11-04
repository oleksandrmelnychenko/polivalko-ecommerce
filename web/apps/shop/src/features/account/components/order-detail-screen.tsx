import { Suspense } from "react";
import { OrderDetail } from "./order-detail";
import { RowsSkeleton } from "./rows-skeleton";

export function OrderDetailScreen() {
  return (
    <Suspense fallback={<RowsSkeleton />}>
      <OrderDetail />
    </Suspense>
  );
}
