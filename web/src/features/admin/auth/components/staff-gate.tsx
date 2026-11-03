"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { components } from "@/shared/api/schema";
import { getMe } from "../api/client";

type StaffMe = components["schemas"]["StaffMeDto"];

const StaffContext = createContext<{ me: StaffMe; isAdmin: boolean } | null>(null);

export function useStaff() {
  const value = useContext(StaffContext);
  if (!value) throw new Error("useStaff: немає StaffGate");
  return value;
}

export function StaffGate({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<StaffMe | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMe().then(({ data, response }) => {
      if (cancelled) return;
      if (data) setMe(data);
      else if (response.status === 401) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    });
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (!me) return <>{fallback}</>;
  return <StaffContext.Provider value={{ me, isAdmin: me.roles.includes("Admin") }}>{children}</StaffContext.Provider>;
}
