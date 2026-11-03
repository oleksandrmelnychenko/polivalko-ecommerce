import Link from "next/link";
import type { NavLink } from "../lib/nav-links";

export function MegaColumn({ title, links }: { title: string; links: NavLink[] }) {
  return (
    <div className="mega-col">
      <p className="mega-col__title">{title}</p>
      <ul>
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
