import type { Metadata } from "next";
import { OfferScreen } from "@/features/shop/content/server";

export const metadata: Metadata = { title: "Публічна оферта", alternates: { canonical: "/offer" } };

export default function OfferPage() {
  return <OfferScreen />;
}
