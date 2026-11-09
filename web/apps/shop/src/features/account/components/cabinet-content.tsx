"use client";

import type { ReactNode } from "react";
import { useCustomer } from "@/features/customer";
import { CabinetSkeleton } from "./cabinet-skeleton";

// Gate private content inside the page, so the layout never drops a route segment.
export function CabinetContent({ children }: { children: ReactNode }) {
  const customer = useCustomer();
  return customer.status === "signedIn" ? children : <CabinetSkeleton />;
}
