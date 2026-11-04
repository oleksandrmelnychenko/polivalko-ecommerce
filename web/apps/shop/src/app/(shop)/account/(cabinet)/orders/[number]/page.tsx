import type { Metadata } from "next";
import { OrderDetailScreen } from "@/features/account";

export const metadata: Metadata = { title: "Замовлення", robots: { index: false, follow: false } };

export default function AccountOrderPage() {
  return <OrderDetailScreen />;
}
