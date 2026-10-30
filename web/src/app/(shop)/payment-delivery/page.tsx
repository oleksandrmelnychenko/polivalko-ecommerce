import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = { title: "Доставка й оплата", alternates: { canonical: "/payment-delivery" } };

export default function PaymentDeliveryPage() {
  return <InfoPage slug="payment-delivery" />;
}
