import type { Metadata } from "next";
import { NotFoundContent } from "@/features/layout/server";

// Drops the root layout's index/follow: Next.js adds its own noindex to a 404, and two tags would contradict.
export const metadata: Metadata = {
  title: "Сторінку не знайдено",
  robots: null,
};

export default function ShopNotFound() {
  return <NotFoundContent />;
}
