import { Suspense } from "react";
import { AdminShell } from "./admin-shell";

// Сторінки панелі клієнтські й залежать від входу працівника: валідацію миттєвої навігації вимикаємо.
export const instant = false;

export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={null}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
