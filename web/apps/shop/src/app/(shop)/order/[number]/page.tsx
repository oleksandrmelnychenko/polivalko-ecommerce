import type { Metadata } from "next";
import { OrderScreen } from "@/features/order/server";

export const metadata: Metadata = { title: "Замовлення", robots: { index: false, follow: false } };

// The order is private and loaded per request before rendering, so a wrong number or token is a real 404.
export const instant = false;

export default function OrderPage(props: PageProps<"/order/[number]">) {
  return <OrderScreen {...props} />;
}
