import type { Metadata } from "next";
import { Breadcrumbs } from "@/features/layout/server";
import { GuestFavoritesScreen } from "@/features/favorites";

export const metadata: Metadata = { title: "Обране", robots: { index: false, follow: true } };

export default function FavoritesPage() {
  return <div className="container compare-page">
    <Breadcrumbs current="Обране" />
    <header className="page-head"><h1>Обране</h1></header>
    <GuestFavoritesScreen />
  </div>;
}
