"use client";

import type { ReactNode } from "react";
import { useStaff } from "./staff-gate";

export function AdminOnly({ title, children }: { title: string; children: ReactNode }) {
  const { isAdmin } = useStaff();
  if (isAdmin) return <>{children}</>;
  return (
    <>
      <h1 className="admin-title">{title}</h1>
      <p className="notice" role="status">
        Розділ доступний лише адміністратору.
      </p>
    </>
  );
}
