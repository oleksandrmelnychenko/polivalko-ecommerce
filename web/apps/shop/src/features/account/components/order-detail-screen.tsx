import { Suspense } from "react";
import { connection } from "next/server";
import { getPickupPoints } from "@/features/content/server";
import { OrderDetail } from "./order-detail";
import { RowsSkeleton } from "./rows-skeleton";

export function OrderDetailScreen() {
  return (
    <Suspense fallback={<RowsSkeleton />}>
      <OrderDetailWithDirectory />
    </Suspense>
  );
}

async function OrderDetailWithDirectory() {
  await connection();
  return <OrderDetail pickupPoints={await getPickupPoints().catch(() => [])} />;
}
