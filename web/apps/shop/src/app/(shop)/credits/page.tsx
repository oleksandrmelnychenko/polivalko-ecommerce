import type { Metadata } from "next";
import { CreditsScreen } from "@/features/content/server";

export const metadata: Metadata = { title: "Автори фото", robots: { index: false, follow: true } };

export default function CreditsPage() {
  return <CreditsScreen />;
}
