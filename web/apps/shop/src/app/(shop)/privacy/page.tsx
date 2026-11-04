import type { Metadata } from "next";
import { InfoPage } from "@/features/content/server";

export const metadata: Metadata = { title: "Політика приватності", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return <InfoPage slug="privacy" />;
}
