import Link from "next/link";
import { ChevronDownIcon } from "@polivalko/shared/ui/icons";
import type { NavLink } from "../lib/nav-links";

export function NavDropdown({ href, label, links }: { href: string; label: string; links: NavLink[] }) {
  return (
    <li className="nav-item">
      <Link href={href} className="nav-link" aria-haspopup="true">
        {label}
        <ChevronDownIcon />
      </Link>
      <ul className="sub sub--drop">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </li>
  );
}
