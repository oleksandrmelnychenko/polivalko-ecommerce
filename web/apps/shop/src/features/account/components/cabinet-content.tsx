"use client";

import type { ReactNode } from "react";
import { refreshSession, useCustomer } from "@/features/customer";
import { CabinetSkeleton } from "./cabinet-skeleton";
import { StateBox } from "./state-box";

// Gate private content inside the page, so the layout never drops a route segment.
export function CabinetContent({ children }: { children: ReactNode }) {
  const customer = useCustomer();
  if (customer.status === "signedIn") return children;
  if (customer.failed)
    return (
      <StateBox
        title="Не вдалося перевірити вхід"
        text="Немає зв'язку з сервером. Ми спробуємо ще раз автоматично."
        action={
          <button type="button" className="btn" onClick={() => void refreshSession()}>
            Спробувати ще раз
          </button>
        }
      />
    );
  return <CabinetSkeleton />;
}
