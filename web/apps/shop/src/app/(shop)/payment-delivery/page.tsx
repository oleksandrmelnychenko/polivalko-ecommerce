import type { Metadata } from "next";
import { DeliveryScreen, pageMetadata } from "@/features/content/server";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("payment-delivery", "Доставка й оплата");
}

export default function PaymentDeliveryPage() {
  return <DeliveryScreen />;
}
