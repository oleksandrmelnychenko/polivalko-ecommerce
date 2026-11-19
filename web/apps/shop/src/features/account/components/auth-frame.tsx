import type { ReactNode } from "react";
import { UserIcon } from "@polivalko/shared/ui/icons";

export function AuthFrame({ title, crumb, lead, children }: { title: string; crumb: string; lead?: ReactNode; perks?: boolean; children: ReactNode }) {
  return (
    <div className="auth-card">
      <header>
        <span className="auth-card__icon"><UserIcon /></span>
        <p className="auth-card__eyebrow">Особистий кабінет · {crumb}</p>
        <h1>{title}</h1>
        {typeof lead === "string" ? <p className="lead">{lead}</p> : lead}
      </header>
      <div className="auth auth--single">
        <div className="auth__main">{children}</div>
      </div>
    </div>
  );
}
