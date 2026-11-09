import Link from "next/link";
import type { NavLink } from "../lib/nav-links";

export function MegaColumn({ title, href, links }: { title: string; href: string; links: NavLink[] }) {
  return (
    <div className="mega-col">
      <Link href={href} className="mega-col__title">
        {title}
      </Link>
      {links.length > 0 && (
        <ul>
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href}>{l.label}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
