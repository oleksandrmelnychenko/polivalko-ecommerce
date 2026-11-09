import Link from "next/link";
import type { ReactNode } from "react";
import { sized } from "@polivalko/shared/lib/images";

type SplitHeroProps = {
  title: string;
  crumb?: string;
  lead?: string | null;
  icon?: ReactNode;
  photo?: { url: string; alt: string };
  actions?: ReactNode;
};

export function SplitHero({ title, crumb, lead, icon, photo, actions }: SplitHeroProps) {
  return (
    <header className="split-hero">
      <nav className="crumbs" aria-label="Хлібні крихти">
        <ol>
          <li>
            <Link href="/">Головна</Link>
          </li>
          <li aria-current="page">{crumb ?? title}</li>
        </ol>
      </nav>
      <div className={photo ? "split-hero__grid" : "split-hero__grid split-hero__grid--solo"}>
        <div className="split-hero__panel">
          {icon && (
            <span className="split-hero__icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <h1>{title}</h1>
          {lead && <p className="split-hero__lead">{lead}</p>}
          {actions && <div className="split-hero__actions">{actions}</div>}
        </div>
        {photo && (
          <figure className="split-hero__photo">
            <img {...sized(photo.url, "(max-width: 60rem) 100vw, 645px", 960)} alt={photo.alt} width={960} height={640} fetchPriority="high" decoding="async" />
          </figure>
        )}
      </div>
    </header>
  );
}
