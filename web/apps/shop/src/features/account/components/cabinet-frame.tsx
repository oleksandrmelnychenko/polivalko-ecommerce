"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { currentPath, loginHref, signOut, useCustomer } from "@/features/customer";
import { CabinetBreadcrumbs, CabinetNav } from "./cabinet-nav";
import { ConfirmBanner } from "./confirm-banner";

export function CabinetFrame({ mailDelivers, children }: { mailDelivers: boolean; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const customer = useCustomer();
  const leaving = useRef(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const me = customer.me;

  useEffect(() => {
    // Next.js can restore this frame after logout; refs survive while effects restart.
    leaving.current = false;
  }, []);

  useEffect(() => {
    if (customer.status === "guest" && !leaving.current) router.replace(loginHref(currentPath()));
  }, [customer.status, router]);

  async function logout() {
    leaving.current = true;
    setLogoutFailed(false);
    if (await signOut(me?.id ?? null)) {
      router.replace("/");
      return;
    }
    leaving.current = false;
    setLogoutFailed(true);
  }

  return (
    <div className="cabinet-workspace">
      <div className="container">
        <CabinetBreadcrumbs pathname={pathname} />
        <header className="cabinet-heading">
          <h1>Особистий кабінет</h1>
        </header>
        <div className="cabinet">
          <div className="cabinet-sidebar">
            {me && (
              <div className="cabinet-identity">
                <span aria-hidden="true">{me.name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toLocaleUpperCase("uk")}</span>
                <strong>{me.name}</strong>
              </div>
            )}
            <CabinetNav pathname={pathname} onLogout={logout} />
          </div>
          <div className="cabinet__main">
            {logoutFailed && (
              <p className="notice notice--error" role="alert">
                Не вдалося вийти. Спробуйте ще раз.
              </p>
            )}
            {me && !me.emailConfirmed && <ConfirmBanner key={me.id} owner={me.id} email={me.email} mailDelivers={mailDelivers} />}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
