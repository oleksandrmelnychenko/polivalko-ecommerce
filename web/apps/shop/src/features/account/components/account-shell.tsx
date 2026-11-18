import { Suspense, type ReactNode } from "react";
import { CabinetFrame } from "./cabinet-frame";
import { CabinetSkeleton } from "./cabinet-skeleton";

type AccountShellProps = { mailDelivers: () => Promise<boolean>; children: ReactNode };

export function AccountShell({ mailDelivers, children }: AccountShellProps) {
  return (
    <Suspense
      fallback={
        <div className="container">
          <CabinetSkeleton />
        </div>
      }
    >
      <AccountFrame mailDelivers={mailDelivers}>{children}</AccountFrame>
    </Suspense>
  );
}

async function AccountFrame({ mailDelivers, children }: AccountShellProps) {
  return <CabinetFrame mailDelivers={await mailDelivers()}>{children}</CabinetFrame>;
}
