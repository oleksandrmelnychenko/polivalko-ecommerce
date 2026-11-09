import type { Metadata } from "next";
import { NotFoundContent, ShopShell } from "@/features/layout/server";

// Drops the root layout's index/follow: Next.js adds its own noindex to a 404, and two tags would contradict.
export const metadata: Metadata = {
  title: "Сторінку не знайдено",
  robots: null,
};

// Unknown URLs render here, above the (shop) layout, so this page brings the shop header and footer itself.
// notFound() from shop pages renders (shop)/not-found.tsx inside that layout instead.
export default function NotFound() {
  return (
    <ShopShell>
      <NotFoundContent />
    </ShopShell>
  );
}
