import { Suspense } from "react";
import { CabinetHead } from "./cabinet-head";
import { OrdersList } from "./orders-list";
import { RowsSkeleton } from "./rows-skeleton";

export function OrdersScreen() {
  return (
    <section aria-labelledby="cabinet-title">
      <CabinetHead title="Мої замовлення" />
      <Suspense fallback={<RowsSkeleton />}>
        <OrdersList />
      </Suspense>
    </section>
  );
}
