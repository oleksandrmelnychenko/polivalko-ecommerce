import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import type { ReactNode } from "react";
import { UserIcon } from "@polivalko/shared/ui/icons";

export function AuthFrame({ title, crumb, lead, children }: { title: string; crumb: string; lead?: ReactNode; perks?: boolean; children: ReactNode }) {
  return (
    <>
      <div className="container"><Breadcrumbs current={crumb} parents={[{ name: "Особистий кабінет", path: "/account" }]} /></div>
      <div className="auth-card">
        <header>
          <span className="auth-card__icon"><UserIcon /></span>

          <h1>{title}</h1>
          {typeof lead === "string" ? <p className="lead">{lead}</p> : lead}
        </header>
        <div className="auth auth--single">
          <div className="auth__main">{children}</div>
        </div>
      </div>
    </>
  );
}
