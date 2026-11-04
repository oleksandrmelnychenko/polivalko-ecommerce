import type { Metadata } from "next";
import { CheckoutScreen } from "@/features/checkout";

export const metadata: Metadata = { title: "Оформлення замовлення", robots: { index: false, follow: false } };

export default function CheckoutPage() {
  return <CheckoutScreen />;
}
