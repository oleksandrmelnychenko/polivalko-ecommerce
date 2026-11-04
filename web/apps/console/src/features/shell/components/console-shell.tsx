"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { StaffGate } from "@/features/auth";
import { useConsoleData } from "@/shared/use-console-data";
import { getSummary } from "../api/client";
import type { Summary } from "../lib/nav";
import { SideBar } from "./side-bar";
import { TopBar } from "./top-bar";

const SummaryContext = createContext<{ summary?: Summary; reload: () => void }>({ reload: () => {} });
export const useSummary = () => useContext(SummaryContext);

export function ConsoleShell({ children }: { children: ReactNode }) {
  return (
    <StaffGate fallback={<div className="console-loading" aria-busy="true">Перевіряємо вхід…</div>}>
      <Shell>{children}</Shell>
    </StaffGate>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const summary = useConsoleData(`shell-summary|${pathname}`, () => getSummary());
  return (
    <SummaryContext.Provider value={{ summary: summary.data, reload: summary.reload }}>
      <div className="console-app">
        <SideBar summary={summary.data} />
        <div className="console-body">
          <TopBar summary={summary.data} />
          <main id="main" className="console-main">
            {children}
          </main>
        </div>
      </div>
    </SummaryContext.Provider>
  );
}
