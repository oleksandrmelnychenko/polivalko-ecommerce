import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CompareScreen } from "@/features/compare";

export const metadata: Metadata = { title: "Порівняння товарів", robots: { index: false, follow: true } };

export default function ComparePage() {
  return (
    <div className="container compare-page">
      <header className="page-head compare-page__head">
        <nav className="crumbs" aria-label="Хлібні крихти"><ol><li><Link href="/">Головна</Link></li><li aria-current="page">Порівняння</li></ol></nav>
        <h1>Порівняння товарів</h1>
        <p>Порівнюйте характеристики до 4 товарів одного типу.</p>
      </header>
      <Suspense fallback={<p className="compare-loading" role="status">Завантажуємо порівняння…</p>}>
        <CompareScreen />
      </Suspense>
    </div>
  );
}
