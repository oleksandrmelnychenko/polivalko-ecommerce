import Link from "next/link";
import type { ReactNode } from "react";

export function StateBox({ title, text, action }: { title: string; text?: ReactNode; action?: { href: string; label: string } | ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {action && typeof action === "object" && "href" in action ? (
        <Link href={action.href} className="btn">
          {action.label}
        </Link>
      ) : (
        action
      )}
    </div>
  );
}
