import { Suspense } from "react";
import { connection } from "next/server";
import type { PickupPoint } from "@polivalko/shared/api/types";
import { OrderDetail } from "./order-detail";
import { RowsSkeleton } from "./rows-skeleton";

type Props = { getPickupPoints: () => Promise<PickupPoint[]> };

export function OrderDetailScreen(props: Props) {
  return (
    <Suspense fallback={<RowsSkeleton />}>
      <OrderDetailWithDirectory {...props} />
    </Suspense>
  );
}

async function OrderDetailWithDirectory({ getPickupPoints }: Props) {
  await connection();
  return <OrderDetail pickupPoints={await getPickupPoints().catch(() => [])} />;
}
