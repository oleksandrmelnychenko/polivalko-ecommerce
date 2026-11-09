import type { ReactNode } from "react";
import { Heading } from "./heading";
import { Rail } from "./rail";

export function Strip({ id, title, sub, side, children }: { id: string; title: string; sub?: string; side: "left" | "right"; children: ReactNode }) {
  return (
    <section className={`strip strip--${side}`} aria-labelledby={id}>
      <div className="container strip__inner">
        <Heading id={id} title={title} sub={sub} side={side} />
        <Rail label={title}>{children}</Rail>
      </div>
    </section>
  );
}
