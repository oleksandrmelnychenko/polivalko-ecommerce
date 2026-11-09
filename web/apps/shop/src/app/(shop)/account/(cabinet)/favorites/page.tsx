import type { Metadata } from "next";
import { CabinetContent, FavoritesScreen } from "@/features/account";

export const metadata: Metadata = { title: "Обране", robots: { index: false, follow: false } };

export default function AccountFavoritesPage() {
  return (
    <CabinetContent>
      <FavoritesScreen />
    </CabinetContent>
  );
}
