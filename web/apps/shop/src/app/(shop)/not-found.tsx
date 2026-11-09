import type { Metadata } from "next";
import { NotFoundContent } from "@/features/layout/server";

export const metadata: Metadata = {
  title: "Сторінку не знайдено",
  robots: null,
};

export default function ShopNotFound() {
  return <NotFoundContent />;
}
