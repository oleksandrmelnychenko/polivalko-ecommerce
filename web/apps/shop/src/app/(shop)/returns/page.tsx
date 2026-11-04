import type { Metadata } from "next";
import { InfoPage } from "@/features/content/server";

export const metadata: Metadata = { title: "Повернення й обмін", alternates: { canonical: "/returns" } };

export default function ReturnsPage() {
  return <InfoPage slug="returns" />;
}
