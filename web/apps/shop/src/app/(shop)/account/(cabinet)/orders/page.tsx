import type { Metadata } from "next";
import { CabinetContent, OrdersScreen } from "@/features/account";

export const metadata: Metadata = { title: "Мої замовлення", robots: { index: false, follow: false } };

export default function AccountOrdersPage() {
  return (
    <CabinetContent>
      <OrdersScreen />
    </CabinetContent>
  );
}
