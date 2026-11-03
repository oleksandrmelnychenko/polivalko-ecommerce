import { Suspense } from "react";
import { AdminShell } from "@/features/admin/shell";

export const instant = false;

export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={null}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
