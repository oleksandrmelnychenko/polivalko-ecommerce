import type { Metadata } from "next";
import { InfoPage, pageMetadata } from "@/features/content/server";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("payment-delivery", "Доставка й оплата");
}

export default function PaymentDeliveryPage() {
  return <InfoPage slug="payment-delivery" />;
}
