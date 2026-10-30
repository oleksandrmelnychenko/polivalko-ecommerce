import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

// Тестова платіжна сторінка імітує сторінку провайдера: окремо від вітрини й поза індексом.
export const instant = false;

export const metadata: Metadata = {
  title: "Тестова оплата",
  robots: { index: false, follow: false },
};

export default function PayLayout({ children }: { children: ReactNode }) {
  // Сторінка клієнтська й читає ідентифікатор рахунку з URL: рендериться лише в браузері.
  return (
    <main id="main" className="paypage">
      <Suspense fallback={<div className="paypage__card skeleton" style={{ height: "20rem" }} aria-busy="true" />}>{children}</Suspense>
    </main>
  );
}
