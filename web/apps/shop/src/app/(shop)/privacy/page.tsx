import type { Metadata } from "next";
import "@/features/content/styles/offer.css";
import { InfoPage, pageMetadata } from "@/features/content/server";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("privacy", "Політика приватності");
}

export default function PrivacyPage() {
  return <InfoPage slug="privacy" title="Політика приватності" lead="Як ми використовуємо ваші дані?" layout="privacy" />;
}
