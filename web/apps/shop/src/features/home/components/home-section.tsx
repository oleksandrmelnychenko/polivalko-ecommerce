import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@polivalko/shared/ui/icons";

type HomeSectionProps = {
  id: string;
  title: string;
  sub?: string;
  more?: { href: string; label: string };
  bordered?: boolean;
  className?: string;
  children: ReactNode;
};

export function HomeSection({ id, title, sub, more, bordered, className, children }: HomeSectionProps) {
  return (
    <section className={["home-section", bordered && "home-section--bordered", className].filter(Boolean).join(" ")} aria-labelledby={id}>
      <div className="container">
        <div className="home-section__head">
          <div className="home-section__titles">
            <h2 id={id}>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          {more && (
            <Link href={more.href} className="home-section__more">
              {more.label}
              <ChevronRightIcon />
            </Link>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
