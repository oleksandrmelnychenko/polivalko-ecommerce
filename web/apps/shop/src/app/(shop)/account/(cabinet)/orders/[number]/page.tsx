import type { Metadata } from "next";
import { getPickupPoints } from "@/features/content/server";
import { CabinetContent, OrderDetailScreen } from "@/features/account";

export const metadata: Metadata = { title: "Замовлення", robots: { index: false, follow: false } };

export default function AccountOrderPage() {
  return (
    <CabinetContent>
      <OrderDetailScreen getPickupPoints={getPickupPoints} />
    </CabinetContent>
  );
}
