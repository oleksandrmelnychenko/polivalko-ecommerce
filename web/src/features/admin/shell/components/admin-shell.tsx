"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { StaffGate } from "@/features/admin/auth";
import { useAdminData } from "@/shared/admin/use-admin-data";
import { getSummary } from "../api/client";
import type { Summary } from "../lib/nav";
import { SideBar } from "./side-bar";
import { TopBar } from "./top-bar";

const SummaryContext = createContext<{ summary?: Summary; reload: () => void }>({ reload: () => {} });
export const useSummary = () => useContext(SummaryContext);

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <StaffGate fallback={<div className="admin-loading" aria-busy="true">Перевіряємо вхід…</div>}>
      <Shell>{children}</Shell>
    </StaffGate>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const summary = useAdminData(`shell-summary|${pathname}`, () => getSummary());
  return (
    <SummaryContext.Provider value={{ summary: summary.data, reload: summary.reload }}>
      <div className="admin-app">
        <SideBar summary={summary.data} />
        <div className="admin-body">
          <TopBar summary={summary.data} />
          <main id="main" className="admin-main">
            {children}
          </main>
        </div>
      </div>
    </SummaryContext.Provider>
  );
}
