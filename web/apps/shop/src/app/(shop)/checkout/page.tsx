import type { Metadata } from "next";
import { CheckoutScreen } from "@/features/checkout";
import { customerMailDelivers, storePhone } from "@/features/content/server";
import { getPickupPoints } from "@/features/content/server";

export const metadata: Metadata = { title: "Оформлення замовлення", robots: { index: false, follow: false } };

export default function CheckoutPage() {
  return <CheckoutScreen mailDelivers={customerMailDelivers} storePhone={storePhone} pickupPoints={getPickupPoints} />;
}
