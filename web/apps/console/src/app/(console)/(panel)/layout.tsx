import { Suspense } from "react";
import { ConsoleShell } from "@/features/shell";

export const instant = false;

export default function PanelLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={null}>
      <ConsoleShell>{children}</ConsoleShell>
    </Suspense>
  );
}
