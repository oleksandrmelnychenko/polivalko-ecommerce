import type { Metadata } from "next";
import { OfferScreen, pageMetadata } from "@/features/content/server";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("offer", "Публічна оферта");
}

export default function OfferPage() {
  return <OfferScreen />;
}
