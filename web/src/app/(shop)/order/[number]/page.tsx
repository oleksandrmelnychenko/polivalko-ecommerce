import type { Metadata } from "next";
import { OrderScreen } from "@/features/shop/order/server";

export const metadata: Metadata = { title: "Замовлення", robots: { index: false, follow: false } };

export default function OrderPage(props: PageProps<"/order/[number]">) {
  return <OrderScreen {...props} />;
}
