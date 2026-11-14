import type { Metadata } from "next";
import { InfoPage, pageMetadata } from "@/features/content/server";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("privacy", "Політика приватності");
}

export default function PrivacyPage() {
  return <InfoPage slug="privacy" layout="rows" />;
}
