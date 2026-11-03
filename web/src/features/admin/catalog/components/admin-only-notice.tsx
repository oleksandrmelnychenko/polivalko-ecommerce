"use client";

import type { ReactNode } from "react";
import { useStaff } from "@/features/admin/auth";

export function AdminOnlyNotice({ children }: { children: ReactNode }) {
  const { isAdmin } = useStaff();
  return isAdmin ? <>{children}</> : <p className="notice">Розділ доступний лише адміністратору.</p>;
}
