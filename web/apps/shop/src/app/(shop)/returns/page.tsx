import type { Metadata } from "next";
import { InfoPage, pageMetadata } from "@/features/content/server";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("returns", "Повернення й обмін");
}

export default function ReturnsPage() {
  return <InfoPage slug="returns" title="Повернення й обмін" lead="Як повернути товар і отримати кошти." layout="rows" />;
}
