import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareScreen } from "@/features/compare";

export const metadata: Metadata = { title: "Порівняння товарів", robots: { index: false, follow: true } };

export default function ComparePage() {
  return (
    <div className="container compare-page">
      <header className="page-head compare-page__head">
        <h1>Порівняння товарів</h1>
      </header>
      <Suspense fallback={<p className="compare-loading" role="status">Завантажуємо порівняння…</p>}>
        <CompareScreen />
      </Suspense>
    </div>
  );
}
