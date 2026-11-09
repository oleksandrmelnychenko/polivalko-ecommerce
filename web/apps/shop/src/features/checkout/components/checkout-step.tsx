import type { ReactNode } from "react";

export function CheckoutStep({ id, icon, title, hint, children }: { id: string; icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="co-step" aria-labelledby={id}>
      <header className="co-step__head">
        <span className="co-step__icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h2 id={id}>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
      </header>
      <div className="co-step__body">{children}</div>
    </section>
  );
}
