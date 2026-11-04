import type { Metadata } from "next";
import { FavoritesScreen } from "@/features/account";

export const metadata: Metadata = { title: "Обране", robots: { index: false, follow: false } };

export default function AccountFavoritesPage() {
  return <FavoritesScreen />;
}
