import type { Metadata } from "next";
import { OrdersScreen } from "@/features/account";

export const metadata: Metadata = { title: "Мої замовлення", robots: { index: false, follow: false } };

export default function AccountPage() {
  return <OrdersScreen />;
}
