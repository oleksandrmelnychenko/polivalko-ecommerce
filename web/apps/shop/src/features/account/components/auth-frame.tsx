import Link from "next/link";
import type { ReactNode } from "react";
import { AuthPerks } from "./auth-perks";

export function AuthFrame({ title, crumb, lead, perks = true, children }: { title: string; crumb: string; lead?: string; perks?: boolean; children: ReactNode }) {
  return (
    <div className="container">
      <header className="page-head">
        <nav className="crumbs" aria-label="Хлібні крихти">
          <ol>
            <li>
              <Link href="/">Головна</Link>
            </li>
            <li aria-current="page">{crumb}</li>
          </ol>
        </nav>
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </header>
      <div className={perks ? "auth" : "auth auth--single"}>
        <div className="auth__main">{children}</div>
        {perks && <AuthPerks />}
      </div>
    </div>
  );
}
