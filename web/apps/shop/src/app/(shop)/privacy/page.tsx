import type { Metadata } from "next";
import { InfoPage, pageMetadata } from "@/features/content/server";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("privacy", "Політика приватності");
}

export default function PrivacyPage() {
  return <InfoPage slug="privacy" title="Політика приватності" lead="Які дані ми збираємо під час замовлення і як їх використовуємо." layout="rows" />;
}
