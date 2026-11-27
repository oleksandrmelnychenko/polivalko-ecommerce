import type { Metadata } from "next";
import { customerMailDelivers, getPickupPoints } from "@/features/content/server";
import { OrderScreen } from "@/features/order/server";

export const metadata: Metadata = { title: "Замовлення", robots: { index: false, follow: false } };

// The order is private and loaded per request before rendering, so a wrong number or token is a real 404.
export const unstable_paramMatching = { number: "blocking" };
export const instant = false;

export default function OrderPage(props: PageProps<"/order/[number]">) {
  return <OrderScreen {...props} mailDelivers={customerMailDelivers} getPickupPoints={getPickupPoints} />;
}
