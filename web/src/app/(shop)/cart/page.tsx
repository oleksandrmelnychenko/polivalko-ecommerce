import type { Metadata } from "next";
import { CartScreen } from "@/features/shop/cart";

export const metadata: Metadata = { title: "Кошик", robots: { index: false, follow: false } };

export default function CartPage() {
  return <CartScreen />;
}
