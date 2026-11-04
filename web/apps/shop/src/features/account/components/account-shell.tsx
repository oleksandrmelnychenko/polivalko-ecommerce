import { Suspense, type ReactNode } from "react";
import { CabinetFrame } from "./cabinet-frame";
import { CabinetSkeleton } from "./cabinet-skeleton";

export function AccountShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="container">
          <CabinetSkeleton />
        </div>
      }
    >
      <CabinetFrame>{children}</CabinetFrame>
    </Suspense>
  );
}
