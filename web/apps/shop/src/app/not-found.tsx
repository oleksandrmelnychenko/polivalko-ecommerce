import type { Metadata } from "next";
import { NotFoundContent, ShopShell } from "@/features/layout/server";

export const metadata: Metadata = {
  title: "Сторінку не знайдено",
  robots: null,
};

export default function NotFound() {
  return (
    <ShopShell>
      <NotFoundContent />
    </ShopShell>
  );
}
