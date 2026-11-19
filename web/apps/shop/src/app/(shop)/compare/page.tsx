import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareScreen } from "@/features/compare";

export const metadata: Metadata = { title: "Порівняння товарів", robots: { index: false, follow: true } };

type Props = { searchParams: Promise<{ group?: string | string[] }> };

async function RequestedComparison({ searchParams }: Props) {
  const { group } = await searchParams;
  const initialGroup = typeof group === "string" ? group : "";
  return <CompareScreen key={initialGroup} initialGroup={initialGroup} />;
}

export default function ComparePage(props: Props) {
  return <Suspense fallback={<p className="container compare-loading" role="status">Завантажуємо порівняння…</p>}><RequestedComparison {...props} /></Suspense>;
}
