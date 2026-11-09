"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { currentPath, loginHref, signOut, useCustomer } from "@/features/customer";
import { CabinetNav } from "./cabinet-nav";
import { CabinetSkeleton } from "./cabinet-skeleton";
import { ConfirmBanner } from "./confirm-banner";

export function CabinetFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const customer = useCustomer();
  const leaving = useRef(false);
  const me = customer.me;

  useEffect(() => {
    if (customer.status === "guest" && !leaving.current) router.replace(loginHref(currentPath()));
  }, [customer.status, router]);

  async function logout() {
    leaving.current = true;
    await signOut();
    router.replace("/");
  }

  return (
    <div className="container">
      <header className="page-head">
        <nav className="crumbs" aria-label="Хлібні крихти">
          <ol>
            <li>
              <Link href="/">Головна</Link>
            </li>
            <li aria-current="page">Особистий кабінет</li>
          </ol>
        </nav>
        <h1>Особистий кабінет</h1>
        <p className="lead cabinet__hello">{me ? `Вітаємо, ${me.name}` : "\u00a0"}</p>
      </header>
      <div className="cabinet">
        <CabinetNav pathname={pathname} onLogout={logout} />
        <div className="cabinet__main">
          {me ? (
            <>
              {!me.emailConfirmed && <ConfirmBanner email={me.email} />}
              {children}
            </>
          ) : (
            <CabinetSkeleton />
          )}
        </div>
      </div>
    </div>
  );
}
