import type { Metadata } from "next";
import { ServicesScreen } from "@/features/shop/services/server";

export const metadata: Metadata = {
  title: "Послуги",
  description: "Ландшафтний дизайн, автополив, озеленення, газони, догляд за садом і обробка рослин.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return <ServicesScreen />;
}
