import { Breadcrumbs } from "@/features/layout/server";
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

export const instant = false;

export const metadata: Metadata = {
  title: "Тестова оплата",
  robots: { index: false, follow: false },
};

export default function PayLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="container"><Breadcrumbs current="Тестова оплата" /></div>
      <main id="main" className="paypage">
        <Suspense fallback={<div className="paypage__card skeleton" style={{ height: "20rem" }} aria-busy="true" />}>{children}</Suspense>
      </main>
    </>
  );
}
