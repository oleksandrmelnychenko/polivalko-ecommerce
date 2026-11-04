import type { ReactNode } from "react";
import { AdminOnly } from "@/features/auth";
import { ContentNav } from "./content-nav";

export function ContentSectionLayout({ children }: { children: ReactNode }) {
  return (
    <AdminOnly title="Контент">
      <ContentNav />
      {children}
    </AdminOnly>
  );
}
